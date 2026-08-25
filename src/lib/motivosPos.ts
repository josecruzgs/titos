// Catálogo de motivos con los que el punto de venta justifica una cancelación o
// una devolución. Matriz los administra desde Configuración y los mostradores
// (matriz y sucursales) los eligen de una lista en vez de escribirlos a mano,
// para que la bitácora se pueda agrupar y comparar entre sucursales.
//
// Este archivo lo importan componentes de cliente, así que no debe arrastrar
// mongoose al bundle del navegador.

export const TIPOS_MOTIVO_POS = ["cancelacion", "devolucion"] as const;

export type TipoMotivoPos = (typeof TIPOS_MOTIVO_POS)[number];

export const TIPO_MOTIVO_LABEL: Record<TipoMotivoPos, string> = {
  cancelacion: "Cancelación",
  devolucion: "Devolución",
};

/** Largo máximo del motivo, igual en el catálogo y en el texto libre. */
export const LARGO_MAXIMO_MOTIVO = 120;

export type MotivoPos = {
  _id: string;
  tipo: TipoMotivoPos;
  texto: string;
  activo: boolean;
  orden: number;
};

/**
 * Motivos con los que arranca el sistema la primera vez. Son solo una semilla:
 * en cuanto matriz crea, edita o borra alguno, manda el catálogo guardado.
 */
export const MOTIVOS_SUGERIDOS: Record<TipoMotivoPos, string[]> = {
  cancelacion: [
    "Error de captura del cajero",
    "El cliente se arrepintió",
    "Producto sin existencia",
    "Precio incorrecto",
    "Cobro duplicado",
    "Falla del sistema o de la impresora",
  ],
  devolucion: [
    "Producto dañado",
    "Producto caducado",
    "Producto equivocado",
    "No era lo que el cliente esperaba",
    "Cantidad o peso incorrecto",
    "Garantía",
  ],
};

export function esTipoMotivoPos(valor: unknown): valor is TipoMotivoPos {
  return typeof valor === "string" && TIPOS_MOTIVO_POS.includes(valor as TipoMotivoPos);
}

/** Recorta y normaliza el motivo tal como se va a guardar. */
export function normalizarMotivo(texto: unknown) {
  return String(texto ?? "").replace(/\s+/g, " ").trim().slice(0, LARGO_MAXIMO_MOTIVO);
}
