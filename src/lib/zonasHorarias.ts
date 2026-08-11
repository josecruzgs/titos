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
