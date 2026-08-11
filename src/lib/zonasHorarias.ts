// Zonas horarias disponibles para las sucursales. Se usan para calcular horas
// locales (corte de pedidos, cortes de caja, reportes por día) en cada sucursal.
export const ZONA_HORARIA_DEFAULT = "America/Tijuana";

export const ZONAS_HORARIAS = [
  { value: "America/Tijuana", label: "Tijuana / Mexicali, B.C. (Pacífico)" },
  { value: "America/Hermosillo", label: "Hermosillo, Son. (Pacífico, sin horario de verano)" },
  { value: "America/Mazatlan", label: "Mazatlán / La Paz, B.C.S. (Pacífico)" },
  { value: "America/Chihuahua", label: "Chihuahua, Chih. (Central)" },
  { value: "America/Ciudad_Juarez", label: "Ciudad Juárez, Chih. (Montaña)" },
  { value: "America/Mexico_City", label: "Ciudad de México (Centro)" },
  { value: "America/Monterrey", label: "Monterrey, N.L. (Centro)" },
  { value: "America/Merida", label: "Mérida, Yuc. (Centro)" },
  { value: "America/Cancun", label: "Cancún, Q. Roo (Sureste)" },
] as const;

export type ZonaHoraria = (typeof ZONAS_HORARIAS)[number]["value"];

const VALORES = new Set<string>(ZONAS_HORARIAS.map((z) => z.value));

export function esZonaHorariaValida(valor: unknown): valor is ZonaHoraria {
  return typeof valor === "string" && VALORES.has(valor);
}

export function zonaHorariaLabel(valor: string | undefined | null) {
  const zona = valor || ZONA_HORARIA_DEFAULT;
  return ZONAS_HORARIAS.find((z) => z.value === zona)?.label ?? zona;
}

/** Fecha local de la sucursal en formato YYYY-MM-DD (para agrupar por día). */
export function fechaEnZona(fecha: Date, zona: string = ZONA_HORARIA_DEFAULT) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

/** Hora local de la sucursal en formato HH:MM de 24 horas (para comparar contra la hora de corte). */
export function horaEnZona(fecha: Date, zona: string = ZONA_HORARIA_DEFAULT) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zona,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
}

// ---------------------------------------------------------------------------
// Formateo para pantalla, tickets y PDFs
//
// Todo lo que se muestra al usuario debe pasar por estos helpers: si se usa
// `toLocaleString` sin `timeZone`, el navegador usa la zona del sistema
// operativo de la PC (mal configurada en varias sucursales) y el servidor usa
// UTC, así que la misma venta se ve con horas distintas según dónde se pinte.
// ---------------------------------------------------------------------------

type FechaLike = Date | string | number | null | undefined;

function aFecha(fecha: FechaLike): Date | null {
  if (fecha === null || fecha === undefined || fecha === "") return null;
  const date = fecha instanceof Date ? fecha : new Date(fecha);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "10/08/26, 09:26 p.m." — el formato de uso general en tablas y listados. */
export function formatFechaHora(fecha: FechaLike, zona: string = ZONA_HORARIA_DEFAULT, vacio = "—") {
  const date = aFecha(fecha);
  if (!date) return vacio;
  return new Intl.DateTimeFormat("es-MX", { timeZone: zona, dateStyle: "short", timeStyle: "short" }).format(date);
}

/** "09:26 p.m." */
export function formatHora(fecha: FechaLike, zona: string = ZONA_HORARIA_DEFAULT, vacio = "—") {
  const date = aFecha(fecha);
  if (!date) return vacio;
  return new Intl.DateTimeFormat("es-MX", { timeZone: zona, hour: "2-digit", minute: "2-digit" }).format(date);
}

/** "10 ago 2026" */
export function formatFechaLarga(fecha: FechaLike, zona: string = ZONA_HORARIA_DEFAULT, vacio = "—") {
  const date = aFecha(fecha);
  if (!date) return vacio;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: zona,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Offset de la zona en el instante dado, en formato "+HH:MM" / "-HH:MM". */
function offsetEnZona(fecha: Date, zona: string) {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: zona, timeZoneName: "longOffset" }).formatToParts(fecha);
  const nombre = partes.find((p) => p.type === "timeZoneName")?.value ?? "";
  // Intl devuelve "GMT-07:00", o solo "GMT" cuando el offset es cero.
  const offset = nombre.replace("GMT", "").trim();
  return offset || "+00:00";
}

/**
 * Convierte una hora local de la sucursal (YYYY-MM-DD + HH:MM:SS.mmm) al
 * instante real. El offset se estima y se corrige una vez, porque el día del
 * cambio de horario de verano el offset del inicio y el del final del día no
 * son el mismo.
 */
function instanteEnZona(ymd: string, horaLocal: string, zona: string) {
  const aproximado = new Date(`${ymd}T${horaLocal}Z`);
  const offset = offsetEnZona(aproximado, zona);
  const candidato = new Date(`${ymd}T${horaLocal}${offset}`);
  const offsetReal = offsetEnZona(candidato, zona);
  return offsetReal === offset ? candidato : new Date(`${ymd}T${horaLocal}${offsetReal}`);
}

/** Instante en el que empieza el día YYYY-MM-DD en la zona de la sucursal. */
export function inicioDelDiaEnZona(ymd: string, zona: string = ZONA_HORARIA_DEFAULT) {
  return instanteEnZona(ymd, "00:00:00.000", zona);
}

/** Último instante del día YYYY-MM-DD en la zona de la sucursal (rango inclusivo). */
export function finDelDiaEnZona(ymd: string, zona: string = ZONA_HORARIA_DEFAULT) {
  return instanteEnZona(ymd, "23:59:59.999", zona);
}

/** Suma días naturales sobre una fecha YYYY-MM-DD sin salir de la zona. */
export function sumarDias(ymd: string, dias: number) {
  const base = new Date(`${ymd}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Primer día (YYYY-MM-01) del mes de la fecha dada, desplazado `meses`. */
export function sumarMeses(ymd: string, meses: number) {
  const base = new Date(`${ymd}T12:00:00Z`);
  base.setUTCDate(1);
  base.setUTCMonth(base.getUTCMonth() + meses);
  return base.toISOString().slice(0, 10);
}
