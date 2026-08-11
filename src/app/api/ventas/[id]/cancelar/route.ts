import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Venta from "@/models/Venta";
import MovimientoInventario from "@/models/MovimientoInventario";
import CuentaPorCobrar from "@/models/CuentaPorCobrar";
import { requireSession, unauthorized, forbidden, badRequest, notFound, conflict } from "@/lib/apiAuth";
import { EPSILON, recalcularSaldoCliente } from "@/lib/credito";
import { ajustarStockPuntoVenta, contextoPuntoVenta, ubicacionDeMovimiento } from "@/lib/puntoVenta";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  const { id } = await params;
  await connectDB();

  const ctx = await contextoPuntoVenta(session);
  if (!ctx) return forbidden();

  const venta = await Venta.findById(id);
  if (!venta) return notFound("Venta no encontrada");
  if (String(venta.sucursalId) !== ctx.sucursalId) return forbidden();
  if (venta.estado === "cancelada") return badRequest("Esta venta ya está cancelada");

  // Si la venta fue a crédito, su cuenta por cobrar se cancela junto con ella.
  // No se puede si el cliente ya abonó algo: eso requiere una nota de crédito.
  const cuenta = await CuentaPorCobrar.findOne({ ventaId: venta._id, estado: { $ne: "cancelada" } });
  if (cuenta) {
    if (cuenta.monto - cuenta.saldo > EPSILON) {
      return conflict(
        "No se puede cancelar: el cliente ya abonó a esta venta a crédito. Ajusta su estado de cuenta con un abono en su lugar."
      );
    }
    cuenta.estado = "cancelada";
    cuenta.saldo = 0;
    await cuenta.save();
    await recalcularSaldoCliente(cuenta.clienteId);
  }

  type VentaItemDoc = (typeof venta.items)[number];

  for (const item of venta.items as VentaItemDoc[]) {
    await ajustarStockPuntoVenta(ctx, item.productoId, item.cantidad);
    await MovimientoInventario.create({
      tipo: "entrada_sucursal",
      productoId: item.productoId,
      nombreProducto: item.nombreProducto,
      ubicacion: ubicacionDeMovimiento(ctx),
      cantidad: item.cantidad,
      ventaId: venta._id,
      usuarioId: session.userId,
    });
  }

  venta.estado = "cancelada";
  await venta.save();

  return NextResponse.json(venta);
}
