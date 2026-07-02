import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import OrdenCompra from "@/models/OrdenCompra";
import Producto from "@/models/Producto";
import MovimientoInventario from "@/models/MovimientoInventario";
import { requireSession, unauthorized, forbidden, badRequest, notFound } from "@/lib/apiAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const items: { productoId: string; cantidadRecibida: number }[] = body?.items ?? [];

  if (items.length === 0) return badRequest("Debes capturar la cantidad recibida de al menos un producto");

  await connectDB();
  const orden = await OrdenCompra.findById(id);
  if (!orden) return notFound("Orden de compra no encontrada");

  if (orden.estado !== "solicitada") {
    return badRequest("Sólo se puede registrar la recepción de órdenes en estado 'solicitada'");
  }

  type OrdenItemDoc = (typeof orden.items)[number];

  for (const entrada of items) {
    const item = orden.items.find((i: OrdenItemDoc) => String(i.productoId) === entrada.productoId);
    if (!item) continue;

    const cantidad = Number(entrada.cantidadRecibida);
    if (cantidad < 0) return badRequest("La cantidad recibida no puede ser negativa");

    item.cantidadRecibida = cantidad;

    if (cantidad > 0) {
      const producto = await Producto.findById(item.productoId);
      if (producto) {
        producto.existenciaMatriz += cantidad;
        await producto.save();

        await MovimientoInventario.create({
          tipo: "entrada_proveedor",
          productoId: producto._id,
          nombreProducto: producto.nombre,
          ubicacion: "matriz",
          cantidad,
          ordenCompraId: orden._id,
          usuarioId: session.userId,
        });
      }
    }
  }

  orden.estado = "recibida";
  orden.fechaRecepcion = new Date();
  await orden.save();

  return NextResponse.json(orden);
}
