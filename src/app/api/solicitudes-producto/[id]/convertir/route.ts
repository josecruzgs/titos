import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SolicitudProductoNuevo from "@/models/SolicitudProductoNuevo";
import Producto from "@/models/Producto";
import NecesidadCompra from "@/models/NecesidadCompra";
import { requireSession, unauthorized, forbidden, badRequest, notFound } from "@/lib/apiAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.sku || !body?.categoria) {
    return badRequest("Faltan campos requeridos (sku, categoria) para dar de alta el producto");
  }

  await connectDB();
  const solicitud = await SolicitudProductoNuevo.findById(id);
  if (!solicitud) return notFound("Solicitud no encontrada");
  if (solicitud.estado === "convertida") {
    return badRequest("Esta solicitud ya fue convertida");
  }

  const producto = await Producto.create({
    sku: body.sku,
    nombre: solicitud.nombreSugerido,
    categoria: body.categoria,
    unidad: solicitud.unidad,
    requierePesaje: Boolean(body.requierePesaje),
    precio: Number(body.precio) || 0,
    existenciaMatriz: 0,
    stockMinimo: Number(body.stockMinimo) || 0,
  });

  const necesidad = await NecesidadCompra.create({
    productoId: producto._id,
    nombreProducto: producto.nombre,
    cantidadRequerida: solicitud.cantidadSugerida,
    motivo: "producto_nuevo",
    pedidosOrigen: solicitud.pedidoId ? [solicitud.pedidoId] : [],
  });

  solicitud.estado = "convertida";
  solicitud.necesidadCompraId = necesidad._id;
  await solicitud.save();

  return NextResponse.json({ producto, necesidad, solicitud }, { status: 201 });
}
