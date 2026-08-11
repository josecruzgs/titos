// Catálogos mínimos del SAT que se capturan al dar de alta un cliente. No se
// timbra nada todavía: son los datos que la sucursal necesita tener a la mano
// para poder facturarle después.

export const REGIMENES_FISCALES = [
  { value: "601", label: "601 — General de Ley Personas Morales" },
  { value: "603", label: "603 — Personas Morales con Fines no Lucrativos" },
  { value: "605", label: "605 — Sueldos y Salarios e Ingresos Asimilados a Salarios" },
  { value: "606", label: "606 — Arrendamiento" },
  { value: "607", label: "607 — Régimen de Enajenación o Adquisición de Bienes" },
  { value: "608", label: "608 — Demás ingresos" },
  { value: "610", label: "610 — Residentes en el Extranjero sin Establecimiento Permanente" },
  { value: "611", label: "611 — Ingresos por Dividendos (socios y accionistas)" },
  { value: "612", label: "612 — Personas Físicas con Actividades Empresariales y Profesionales" },
  { value: "614", label: "614 — Ingresos por intereses" },
  { value: "615", label: "615 — Régimen de los ingresos por obtención de premios" },
  { value: "616", label: "616 — Sin obligaciones fiscales" },
  { value: "620", label: "620 — Sociedades Cooperativas de Producción" },
  { value: "621", label: "621 — Incorporación Fiscal" },
  { value: "622", label: "622 — Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras" },
  { value: "623", label: "623 — Opcional para Grupos de Sociedades" },
  { value: "624", label: "624 — Coordinados" },
  { value: "625", label: "625 — Régimen de Actividades Empresariales con ingresos a través de Plataformas Tecnológicas" },
  { value: "626", label: "626 — Régimen Simplificado de Confianza (RESICO)" },
] as const;

export const USOS_CFDI = [
  { value: "G01", label: "G01 — Adquisición de mercancías" },
  { value: "G02", label: "G02 — Devoluciones, descuentos o bonificaciones" },
  { value: "G03", label: "G03 — Gastos en general" },
  { value: "I01", label: "I01 — Construcciones" },
  { value: "I02", label: "I02 — Mobiliario y equipo de oficina por inversiones" },
  { value: "I03", label: "I03 — Equipo de transporte" },
  { value: "I04", label: "I04 — Equipo de cómputo y accesorios" },
  { value: "I08", label: "I08 — Otra maquinaria y equipo" },
  { value: "D01", label: "D01 — Honorarios médicos, dentales y gastos hospitalarios" },
  { value: "D10", label: "D10 — Pagos por servicios educativos (colegiaturas)" },
  { value: "S01", label: "S01 — Sin efectos fiscales" },
  { value: "CP01", label: "CP01 — Pagos" },
] as const;

export const REGIMENES_FISCALES_VALORES = REGIMENES_FISCALES.map((r) => r.value);
export const USOS_CFDI_VALORES = USOS_CFDI.map((u) => u.value);

/** RFC de persona física (13) o moral (12). No valida el dígito verificador. */
const RFC_REGEX = /^([A-ZÑ&]{3,4})\d{6}[A-Z\d]{3}$/;

export function normalizarRfc(rfc: string) {
  return rfc.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function esRfcValido(rfc: string) {
  return RFC_REGEX.test(normalizarRfc(rfc));
}
