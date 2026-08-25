import Venta from "@/models/Venta";
import MovimientoCaja from "@/models/MovimientoCaja";
import AbonoCliente from "@/models/AbonoCliente";
import Devolucion from "@/models/Devolucion";

export async function calcularResumenSesion(cajaSesionId: string) {
  const ventas = await Venta.find({ cajaSesionId, estado: "completada", esVentas2: { $ne: true } }).select("pagos").lean();

  let totalVentasEfectivo = 0;
  let totalVentasTarjeta = 0;
  let totalVentasTransferencia = 0;
  // Los vales de despensa se entregan físicamente pero no son efectivo: se
  // cuentan aparte porque se depositan/cobran al emisor, no en el cajón.
  let totalVentasVales = 0;
  // El crédito no es dinero en caja: se reporta aparte para cuadrar el corte.
  let totalVentasCredito = 0;
  for (const v of ventas) {
    for (const pago of v.pagos) {
      if (pago.metodoPago === "efectivo") totalVentasEfectivo += pago.monto;
      else if (pago.metodoPago === "tarjeta") totalVentasTarjeta += pago.monto;
      else if (pago.metodoPago === "transferencia") totalVentasTransferencia += pago.monto;
      else if (pago.metodoPago === "vales") totalVentasVales += pago.monto;
      else if (pago.metodoPago === "credito") totalVentasCredito += pago.monto;
    }
  }

  // Los abonos de clientes sí son cobranza del turno: el efectivo entra al cajón.
  const abonos = await AbonoCliente.find({ cajaSesionId }).select("monto metodoPago").lean();
  let totalAbonosEfectivo = 0;
  let totalAbonosOtros = 0;
  for (const abono of abonos) {
    if (abono.metodoPago === "efectivo") totalAbonosEfectivo += abono.monto;
    else totalAbonosOtros += abono.monto;
  }

  // Reembolsos pagados durante este turno, incluidos los de ventas de días
  // anteriores cuyo corte ya estaba cerrado.
  const devoluciones = await Devolucion.find({ cajaSesionId, estado: "pagada" }).select("montoEfectivo").lean();
  const totalDevoluciones = devoluciones.reduce((sum, d) => sum + (d.montoEfectivo ?? 0), 0);

  const retiros = await MovimientoCaja.find({ cajaSesionId }).select("monto moneda").lean();
  let totalRetiros = 0;
  let totalRetirosUsd = 0;
  for (const retiro of retiros) {
    if (retiro.moneda === "USD") totalRetirosUsd += retiro.monto;
    else totalRetiros += retiro.monto;
  }

  return {
    cantidadVentas: ventas.length,
    cantidadRetiros: retiros.length,
    cantidadAbonos: abonos.length,
    cantidadDevoluciones: devoluciones.length,
    totalVentasEfectivo,
    totalVentasTarjeta,
    totalVentasTransferencia,
    totalVentasVales,
    totalVentasCredito,
    totalAbonosEfectivo,
    totalAbonosOtros,
    totalDevoluciones,
    totalRetiros,
    totalRetirosUsd,
  };
}

export type ResumenSesion = Awaited<ReturnType<typeof calcularResumenSesion>>;

/** Efectivo en pesos que debe haber al cerrar: fondo + ventas + cobranza − devoluciones − retiros. */
export function calcularEfectivoEsperado(
  efectivoInicial: number,
  resumen: Pick<ResumenSesion, "totalVentasEfectivo" | "totalAbonosEfectivo" | "totalDevoluciones" | "totalRetiros">
) {
  return Number(
    (
      efectivoInicial +
      resumen.totalVentasEfectivo +
      resumen.totalAbonosEfectivo -
      resumen.totalDevoluciones -
      resumen.totalRetiros
    ).toFixed(2)
  );
}

/** Dólares que deben quedar: el cajón de USD solo se mueve por retiros. */
export function calcularEfectivoEsperadoUsd(
  efectivoInicialUsd: number,
  resumen: Pick<ResumenSesion, "totalRetirosUsd">
) {
  return Number((efectivoInicialUsd - resumen.totalRetirosUsd).toFixed(2));
}
