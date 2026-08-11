// Tipos y helpers de crédito compartidos por el módulo de clientes y el punto
// de venta. Sin dependencias de servidor para que ambos los puedan importar.

import { formatFechaLarga, ZONA_HORARIA_DEFAULT } from "@/lib/zonasHorarias";

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

export type ClienteConCredito = {
  _id: string;
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  notas: string;
  activo: boolean;
  saldo: number;
  credito: { activo: boolean; limite: number; diasCredito: number };
  facturacion: {
    razonSocial: string;
    rfc: string;
    regimenFiscal: string;
    usoCfdi: string;
    codigoPostal: string;
    direccionFiscal: string;
    emailFacturacion: string;
  };
  resumen: ResumenCredito;
};

export function formatFecha(iso: string | null | undefined, zona: string = ZONA_HORARIA_DEFAULT) {
  return formatFechaLarga(iso, zona);
}

export function estadoCredito(resumen: ResumenCredito) {
  if (!resumen.creditoActivo) return { label: "Sin crédito", className: "bg-black/5 text-black/50" };
  if (resumen.tieneVencidos) return { label: "Vencido", className: "bg-red-100 text-red-700" };
  if (resumen.saldo > 0) return { label: "Al corriente", className: "bg-amber-100 text-amber-800" };
  return { label: "Sin adeudo", className: "bg-titos-green-100 text-titos-green-700" };
}
