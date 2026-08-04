import Venta from "@/models/Venta";
import MovimientoCaja from "@/models/MovimientoCaja";

export async function calcularResumenSesion(cajaSesionId: string) {
  const ventas = await Venta.find({ cajaSesionId, estado: "completada", esVentas2: { $ne: true } }).select("pagos").lean();

  let totalVentasEfectivo = 0;
  let totalVentasTarjeta = 0;
  let totalVentasTransferencia = 0;
  for (const v of ventas) {
    for (const pago of v.pagos) {
      if (pago.metodoPago === "efectivo") totalVentasEfectivo += pago.monto;
      else if (pago.metodoPago === "tarjeta") totalVentasTarjeta += pago.monto;
      else if (pago.metodoPago === "transferencia") totalVentasTransferencia += pago.monto;
    }
  }

  const retiros = await MovimientoCaja.find({ cajaSesionId }).select("monto").lean();
  const totalRetiros = retiros.reduce((sum, r) => sum + r.monto, 0);

  return {
    cantidadVentas: ventas.length,
    cantidadRetiros: retiros.length,
    totalVentasEfectivo,
    totalVentasTarjeta,
    totalVentasTransferencia,
    totalRetiros,
  };
}
