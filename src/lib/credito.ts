import Cliente from "@/models/Cliente";
import CuentaPorCobrar from "@/models/CuentaPorCobrar";
import Sucursal from "@/models/Sucursal";
import { fechaEnZona, ZONA_HORARIA_DEFAULT } from "@/lib/zonasHorarias";

/** Zona horaria de la sucursal; define qué día es "hoy" al evaluar vencimientos. */
export async function zonaHorariaDeSucursal(sucursalId: unknown) {
  const sucursal = await Sucursal.findById(sucursalId).select("zonaHoraria").lean();
  return (sucursal as { zonaHoraria?: string } | null)?.zonaHoraria || ZONA_HORARIA_DEFAULT;
}

/** Tolerancia de centavos para comparar montos de dinero. */
export const EPSILON = 0.005;

export function redondear(monto: number) {
  return Math.round(monto * 100) / 100;
}

export type CuentaLike = {
  _id: unknown;
  folio: string;
  fecha: Date;
  fechaVencimiento: Date;
  monto: number;
  saldo: number;
  estado: string;
};

export type ClienteCreditoLike = {
  activo: boolean;
  credito?: { activo?: boolean; limite?: number; diasCredito?: number } | null;
};

/**
 * Una cuenta está vencida cuando el día local de la sucursal ya pasó el día del
 * vencimiento. Se compara por día calendario, no por hora: el cliente tiene
 * todo el día de la fecha máxima estipulada para pagar.
 */
export function estaVencida(cuenta: Pick<CuentaLike, "fechaVencimiento">, zonaHoraria: string, ahora: Date) {
  return fechaEnZona(ahora, zonaHoraria) > fechaEnZona(cuenta.fechaVencimiento, zonaHoraria);
}

export function calcularVencimiento(fecha: Date, diasCredito: number) {
  return new Date(fecha.getTime() + diasCredito * 24 * 60 * 60 * 1000);
}

export type ResumenCredito = {
  creditoActivo: boolean;
  limite: number;
  diasCredito: number;
  saldo: number;
  saldoVencido: number;
  disponible: number;
  tieneVencidos: boolean;
  cuentasVencidas: number;
  proximoVencimiento: string | null;
};

export function resumenCredito(
  cliente: ClienteCreditoLike,
  cuentasPendientes: CuentaLike[],
  zonaHoraria: string = ZONA_HORARIA_DEFAULT,
  ahora: Date = new Date()
): ResumenCredito {
  const limite = cliente.credito?.limite ?? 0;
  const diasCredito = cliente.credito?.diasCredito ?? 30;

  let saldo = 0;
  let saldoVencido = 0;
  let cuentasVencidas = 0;
  let proximo: Date | null = null;

  for (const cuenta of cuentasPendientes) {
    saldo += cuenta.saldo;
    if (estaVencida(cuenta, zonaHoraria, ahora)) {
      saldoVencido += cuenta.saldo;
      cuentasVencidas += 1;
    } else if (!proximo || cuenta.fechaVencimiento < proximo) {
      proximo = cuenta.fechaVencimiento;
    }
  }

  saldo = redondear(saldo);
  saldoVencido = redondear(saldoVencido);

  return {
    creditoActivo: !!cliente.credito?.activo,
    limite,
    diasCredito,
    saldo,
    saldoVencido,
    disponible: redondear(Math.max(0, limite - saldo)),
    tieneVencidos: saldoVencido > EPSILON,
    cuentasVencidas,
    proximoVencimiento: proximo ? proximo.toISOString() : null,
  };
}

/**
 * Reglas para vender a crédito. Devuelve el motivo del rechazo o null si procede.
 * El orden importa: primero se avisa de la deuda vencida, que es la que bloquea
 * al cliente aunque todavía tenga límite disponible.
 */
export function motivoRechazoCredito(
  cliente: ClienteCreditoLike,
  resumen: ResumenCredito,
  monto: number
): string | null {
  if (!cliente.activo) return "El cliente está inactivo";
  if (!resumen.creditoActivo) return "Este cliente no tiene crédito autorizado";
  if (resumen.limite <= 0) return "El cliente tiene crédito autorizado pero sin límite asignado";
  if (resumen.tieneVencidos) {
    return `El cliente tiene ${formatoMoneda(resumen.saldoVencido)} en pagos vencidos. Debe liquidarlos antes de volver a comprar a crédito.`;
  }
  if (monto <= 0) return "El monto a crédito debe ser mayor a cero";
  if (monto - resumen.disponible > EPSILON) {
    return `El monto excede el crédito disponible del cliente (disponible ${formatoMoneda(resumen.disponible)} de un límite de ${formatoMoneda(resumen.limite)})`;
  }
  return null;
}

function formatoMoneda(valor: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(valor);
}

/** Aplica un abono a las cuentas abiertas, de la más vieja a la más nueva. */
export function aplicarAbonoFIFO(cuentas: CuentaLike[], monto: number) {
  const ordenadas = [...cuentas].sort((a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime());
  const aplicaciones: { cuentaId: unknown; folio: string; monto: number; saldoRestante: number }[] = [];
  let restante = redondear(monto);

  for (const cuenta of ordenadas) {
    if (restante <= EPSILON) break;
    const aplicado = redondear(Math.min(cuenta.saldo, restante));
    if (aplicado <= EPSILON) continue;
    restante = redondear(restante - aplicado);
    aplicaciones.push({
      cuentaId: cuenta._id,
      folio: cuenta.folio,
      monto: aplicado,
      saldoRestante: redondear(cuenta.saldo - aplicado),
    });
  }

  return { aplicaciones, sobrante: restante };
}

/** Vuelve a calcular el saldo del cliente desde sus cuentas abiertas y lo persiste. */
export async function recalcularSaldoCliente(clienteId: unknown) {
  const cuentas = await CuentaPorCobrar.find({ clienteId, estado: "pendiente" }).select("saldo").lean();
  const saldo = redondear(cuentas.reduce((sum, c) => sum + c.saldo, 0));
  await Cliente.findByIdAndUpdate(clienteId, { saldo });
  return saldo;
}

/** Carga cliente + cuentas abiertas + resumen en un solo paso. */
export async function cargarEstadoCredito(clienteId: string, zonaHoraria: string, ahora = new Date()) {
  const cliente = await Cliente.findById(clienteId);
  if (!cliente) return null;
  const cuentas = await CuentaPorCobrar.find({ clienteId, estado: "pendiente" }).sort({ fechaVencimiento: 1 });
  return { cliente, cuentas, resumen: resumenCredito(cliente, cuentas, zonaHoraria, ahora) };
}
