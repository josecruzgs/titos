import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Venta from "@/models/Venta";
import InventarioSucursal from "@/models/InventarioSucursal";
import MovimientoInventario from "@/models/MovimientoInventario";
import { requireSession, unauthorized, forbidden, badRequest, notFound } from "@/lib/apiAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  const { id } = await params;
  await connectDB();

  const venta = await Venta.findById(id);
  if (!venta) return notFound("Venta no encontrada");
  if (String(venta.sucursalId) !== session.sucursalId) return forbidden();
  if (venta.estado === "cancelada") return badRequest("Esta venta ya está cancelada");

  type VentaItemDoc = (typeof venta.items)[number];

  for (const item of venta.items as VentaItemDoc[]) {
    await InventarioSucursal.findOneAndUpdate(
      { sucursalId: session.sucursalId, productoId: item.productoId },
      { $inc: { stockActual: item.cantidad } },
      { upsert: true }
    );
    await MovimientoInventario.create({
      tipo: "entrada_sucursal",
      productoId: item.productoId,
      nombreProducto: item.nombreProducto,
      ubicacion: session.sucursalId,
      cantidad: item.cantidad,
      ventaId: venta._id,
      usuarioId: session.userId,
    });
  }

  venta.estado = "cancelada";
  await venta.save();

  return NextResponse.json(venta);
}
