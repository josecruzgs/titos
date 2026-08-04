import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Producto from "@/models/Producto";
import ActualizacionPrecio from "@/models/ActualizacionPrecio";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rangoPeriodo(url: URL) {
  const ahora = new Date();
  const desdeParam = url.searchParams.get("desde");
  const hastaParam = url.searchParams.get("hasta");
  // Por default: la última hora
  const desde = desdeParam ? new Date(desdeParam) : new Date(ahora.getTime() - 60 * 60 * 1000);
  const hasta = hastaParam ? new Date(hastaParam) : ahora;
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return null;
  return { desde, hasta };
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const rango = rangoPeriodo(new URL(req.url));
  if (!rango) return badRequest("Periodo inválido");

  await connectDB();
  const cambios = await ActualizacionPrecio.find({ createdAt: { $gte: rango.desde, $lte: rango.hasta } })
    .populate("productoId", "linea categoria anaquel unidad precioCompra activo")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(
    cambios.map((c) => {
      const producto = (c.productoId ?? {}) as {
        linea?: string;
        categoria?: string;
        anaquel?: string;
        unidad?: string;
        precioCompra?: number;
      };
      return {
        _id: String(c._id),
        sku: c.sku,
        nombre: c.nombre,
        linea: producto.linea ?? "",
        categoria: producto.categoria ?? "",
        anaquel: producto.anaquel ?? "",
        unidad: producto.unidad ?? "",
        precioCompra: producto.precioCompra ?? null,
        precioAnterior: c.precioAnterior,
        precioNuevo: c.precioNuevo,
        origen: c.origen,
        fecha: c.createdAt,
      };
    })
  );
}

type ItemEntrada = { productoId?: string; codigo?: string; precio: unknown };

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return badRequest("Debes enviar al menos un producto a actualizar");
  }
  const origen = body.origen === "excel" ? "excel" : "manual";
  if (body.items.length > 2000) return badRequest("Máximo 2000 productos por importación");

  await connectDB();

  let actualizados = 0;
  const noEncontrados: string[] = [];
  const invalidos: string[] = [];
  const sinCambio: string[] = [];

  for (const item of body.items as ItemEntrada[]) {
    const codigo = String(item.codigo ?? "").trim();
    const etiqueta = codigo || String(item.productoId ?? "");
    const precio = Number(item.precio);

    if (!Number.isFinite(precio) || precio <= 0) {
      invalidos.push(etiqueta);
      continue;
    }

    const producto = item.productoId
      ? await Producto.findById(item.productoId)
      : await Producto.findOne({ sku: new RegExp(`^${escapeRegExp(codigo)}$`, "i") });

    if (!producto) {
      noEncontrados.push(etiqueta);
      continue;
    }

    const precioNuevo = Number(precio.toFixed(2));
    if (producto.precioVenta === precioNuevo) {
      sinCambio.push(producto.sku);
      continue;
    }

    const precioAnterior = producto.precioVenta;
    producto.precioVenta = precioNuevo;
    await producto.save();

    await ActualizacionPrecio.create({
      productoId: producto._id,
      sku: producto.sku,
      nombre: producto.nombre,
      precioAnterior,
      precioNuevo,
      origen,
      usuarioId: session.userId,
    });
    actualizados++;
  }

  return NextResponse.json({ actualizados, noEncontrados, invalidos, sinCambio });
}
