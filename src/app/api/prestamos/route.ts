import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import PrestamoSucursal from "@/models/PrestamoSucursal";
import Producto from "@/models/Producto";
import Sucursal from "@/models/Sucursal";
import { requireSession, unauthorized, forbidden, badRequest, generateFolio, puede, sinPermiso } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  await connectDB();

  const url = new URL(req.url);

  if (session.role === "matriz") {
    const prestamos = await PrestamoSucursal.find({}).sort({ createdAt: -1 }).limit(200).lean();
    return NextResponse.json(prestamos);
  }
  if (!session.sucursalId) return forbidden();

  // "solicitados" = los que esta sucursal pidió; "recibidos" = los que le piden a ella.
  const rol = url.searchParams.get("rol");
  const filtro =
    rol === "solicitante"
      ? { sucursalSolicitanteId: session.sucursalId }
      : rol === "prestamista"
        ? { sucursalPrestamistaId: session.sucursalId }
        : {
            $or: [
              { sucursalSolicitanteId: session.sucursalId },
              { sucursalPrestamistaId: session.sucursalId },
            ],
          };

  const prestamos = await PrestamoSucursal.find(filtro).sort({ createdAt: -1 }).limit(200).lean();
  return NextResponse.json(prestamos);
}

type ItemSolicitud = { productoId: string; cantidad: number };

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (!puede(session, "prestamos.operar")) return sinPermiso("prestamos.operar");
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  const body = await req.json().catch(() => null);
  const sucursalPrestamistaId = String(body?.sucursalPrestamistaId ?? "");
  const itemsBody: ItemSolicitud[] = body?.items ?? [];
  const notas = String(body?.notas ?? "").trim();

  if (!sucursalPrestamistaId) return badRequest("Indica a qué sucursal le vas a pedir prestado");
  if (sucursalPrestamistaId === String(session.sucursalId)) {
    return badRequest("No puedes pedirte prestado a ti mismo");
  }
  if (itemsBody.length === 0) return badRequest("Agrega al menos un producto a la solicitud");

  await connectDB();

  const [solicitante, prestamista] = await Promise.all([
    Sucursal.findById(session.sucursalId).select("nombre").lean(),
    Sucursal.findById(sucursalPrestamistaId).select("nombre activo").lean(),
  ]);
  if (!prestamista || !prestamista.activo) return badRequest("La sucursal a la que le pides no existe o está inactiva");

  const productos = await Producto.find({ _id: { $in: itemsBody.map((i) => i.productoId) }, activo: true })
    .select("sku nombre unidad")
    .lean();
  const productoPorId = new Map(productos.map((p) => [String(p._id), p]));

  const items = [];
  for (const item of itemsBody) {
    const producto = productoPorId.get(String(item.productoId));
    const cantidad = Number(item.cantidad);
    if (!producto) return badRequest("Uno de los productos no existe o está inactivo");
    if (!Number.isFinite(cantidad) || cantidad <= 0) return badRequest("Captura una cantidad válida para cada producto");
    items.push({
      productoId: producto._id,
      sku: producto.sku,
      nombreProducto: producto.nombre,
      unidad: producto.unidad,
      cantidadSolicitada: cantidad,
    });
  }

  const prestamo = await PrestamoSucursal.create({
    folio: generateFolio("PRE"),
    sucursalSolicitanteId: session.sucursalId,
    sucursalSolicitanteNombre: solicitante?.nombre ?? "",
    sucursalPrestamistaId,
    sucursalPrestamistaNombre: prestamista.nombre,
    items,
    estado: "solicitado",
    notas,
    solicitadoPorId: session.userId,
    solicitadoEn: new Date(),
  });

  return NextResponse.json(prestamo, { status: 201 });
}
