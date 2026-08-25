import { esRfcValido, normalizarRfc } from "@/lib/facturacion";

// Lectura del PDF de la Constancia de Situación Fiscal (CSF) que emite el SAT.
// Sirve para dar de alta un cliente sin recapturar sus datos fiscales a mano.

/**
 * Nombres oficiales de los regímenes tal como los imprime la constancia, para
 * poder traducirlos a la clave del catálogo c_RegimenFiscal.
 */
export const REGIMENES_POR_NOMBRE: { clave: string; nombre: string }[] = [
  { clave: "601", nombre: "General de Ley Personas Morales" },
  { clave: "603", nombre: "Personas Morales con Fines no Lucrativos" },
  { clave: "605", nombre: "Sueldos y Salarios e Ingresos Asimilados a Salarios" },
  { clave: "606", nombre: "Arrendamiento" },
  { clave: "607", nombre: "Régimen de Enajenación o Adquisición de Bienes" },
  { clave: "608", nombre: "Demás ingresos" },
  { clave: "610", nombre: "Residentes en el Extranjero sin Establecimiento Permanente en México" },
  { clave: "611", nombre: "Ingresos por Dividendos (socios y accionistas)" },
  { clave: "612", nombre: "Personas Físicas con Actividades Empresariales y Profesionales" },
  { clave: "614", nombre: "Ingresos por intereses" },
  { clave: "615", nombre: "Régimen de los ingresos por obtención de premios" },
  { clave: "616", nombre: "Sin obligaciones fiscales" },
  { clave: "620", nombre: "Sociedades Cooperativas de Producción que optan por diferir sus ingresos" },
  { clave: "621", nombre: "Incorporación Fiscal" },
  { clave: "622", nombre: "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras" },
  { clave: "623", nombre: "Opcional para Grupos de Sociedades" },
  { clave: "624", nombre: "Coordinados" },
  { clave: "625", nombre: "Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas" },
  { clave: "626", nombre: "Régimen Simplificado de Confianza" },
];

/**
 * Etiquetas que imprime la constancia. Se usan como separadores: el valor de un
 * campo es todo lo que va entre su etiqueta y la siguiente.
 */
const ETIQUETAS = [
  "RFC",
  "idCIF",
  "CURP",
  "Nombre (s)",
  "Nombre(s)",
  "Primer Apellido",
  "Segundo Apellido",
  "Denominación/Razón Social",
  "Denominación o Razón Social",
  "Régimen Capital",
  "Fecha inicio de operaciones",
  "Fecha de inicio de operaciones",
  "Situación del contribuyente",
  "Estatus en el padrón",
  "Fecha de último cambio de estado",
  "Nombre Comercial",
  "Código Postal",
  "Tipo de Vialidad",
  "Nombre de Vialidad",
  "Número Exterior",
  "Número Interior",
  "Nombre de la Colonia",
  "Nombre de la Localidad",
  "Nombre del Municipio o Demarcación Territorial",
  "Nombre de la Entidad Federativa",
  "Entre Calle",
  "Y Calle",
  "Correo electrónico",
  "Tel. Fijo Lada",
  "Número",
  "Regímenes",
  "Régimen",
  "Fecha de Alta",
  "Fecha Inicio",
  "Obligaciones",
];

export type DatosConstancia = {
  rfc: string;
  razonSocial: string;
  regimenFiscal: string;
  regimenesDetectados: { clave: string; nombre: string }[];
  codigoPostal: string;
  direccionFiscal: string;
  email: string;
  telefono: string;
  /** Campos que no se pudieron leer y hay que capturar a mano. */
  faltantes: string[];
};

function sinAcentos(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizar(texto: string) {
  return sinAcentos(texto).toLowerCase().replace(/\s+/g, " ").trim();
}

function escaparRegex(texto: string) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// La extracción de texto de un PDF no siempre conserva los acentos (depende de
// cómo esté embebida la fuente), así que las etiquetas se buscan aceptando la
// vocal con y sin acento.
const CLASES_ACENTO: Record<string, string> = {
  a: "[aá]",
  e: "[eé]",
  i: "[ií]",
  o: "[oó]",
  u: "[uúü]",
  n: "[nñ]",
};

/** Patrón que reconoce una etiqueta con o sin acentos (y sin importar mayúsculas). */
function patronEtiqueta(etiqueta: string) {
  return escaparRegex(sinAcentos(etiqueta)).replace(
    /[aeioun]/gi,
    (letra) => CLASES_ACENTO[letra.toLowerCase()] ?? letra
  );
}

/** Extrae el texto del PDF con pdfjs, página por página. */
export async function extraerTextoPdf(buffer: Buffer): Promise<string> {
  // La build "legacy" es la que corre en Node sin worker ni APIs del navegador.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const tarea = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    useSystemFonts: true,
  });

  try {
    const documento = await tarea.promise;
    const paginas: string[] = [];

    for (let i = 1; i <= documento.numPages; i++) {
      const pagina = await documento.getPage(i);
      const contenido = await pagina.getTextContent();
      paginas.push(contenido.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }

    return paginas.join("\n");
  } finally {
    // Libera el worker aunque la lectura falle a medias.
    await tarea.destroy();
  }
}

/**
 * Parte el texto en pares etiqueta/valor. La constancia imprime todo como
 * "Etiqueta: valor", así que el valor de un campo es lo que hay hasta la
 * siguiente etiqueta conocida.
 */
function extraerCampos(texto: string): Map<string, string> {
  // De más larga a más corta: la alternancia del regex se queda con la primera
  // que case, y "Número Exterior" debe ganarle a "Número".
  const etiquetas = [...ETIQUETAS].sort((a, b) => b.length - a.length);
  // Un grupo por etiqueta para saber cuál casó y poder usar su nombre canónico
  // aunque en el PDF venga sin acentos.
  const alternancia = etiquetas.map((e) => `(${patronEtiqueta(e)})`).join("|");
  const regex = new RegExp(`(?:${alternancia})\\s*:`, "gi");

  const campos = new Map<string, string>();
  const coincidencias = [...texto.matchAll(regex)];

  for (let i = 0; i < coincidencias.length; i++) {
    const actual = coincidencias[i];
    const grupo = etiquetas.findIndex((_, idx) => actual[idx + 1] !== undefined);
    if (grupo === -1) continue;

    const inicio = (actual.index ?? 0) + actual[0].length;
    const fin = i + 1 < coincidencias.length ? coincidencias[i + 1].index ?? texto.length : texto.length;
    const valor = texto.slice(inicio, fin).replace(/\s+/g, " ").trim();

    // Solo se conserva la primera aparición: la cédula del encabezado repite el
    // RFC y no queremos que un valor posterior vacío lo pise.
    const clave = etiquetas[grupo];
    if (!campos.has(clave) && valor) campos.set(clave, valor);
  }

  return campos;
}

function primero(campos: Map<string, string>, ...llaves: string[]) {
  for (const llave of llaves) {
    const valor = campos.get(llave);
    if (valor) return valor;
  }
  return "";
}

/** Busca en el texto completo los regímenes que aparecen listados. */
function detectarRegimenes(texto: string) {
  const normalizado = normalizar(texto);
  return REGIMENES_POR_NOMBRE.filter((r) => normalizado.includes(normalizar(r.nombre))).map((r) => ({
    clave: r.clave,
    nombre: r.nombre,
  }));
}

export function parsearConstancia(texto: string): DatosConstancia {
  const campos = extraerCampos(texto);

  // El RFC del cuerpo puede venir pegado a otra palabra; se recorta al patrón.
  const rfcCrudo = primero(campos, "RFC");
  const rfcMatch = rfcCrudo.match(/[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}/i);
  const rfc = rfcMatch ? normalizarRfc(rfcMatch[0]) : "";

  const denominacion = primero(campos, "Denominación/Razón Social", "Denominación o Razón Social");
  const nombre = primero(campos, "Nombre (s)", "Nombre(s)");
  const primerApellido = campos.get("Primer Apellido") ?? "";
  const segundoApellido = campos.get("Segundo Apellido") ?? "";

  // Persona moral trae razón social; persona física, nombre y apellidos.
  const razonSocial = denominacion
    ? denominacion.replace(/\s+/g, " ").trim()
    : [nombre, primerApellido, segundoApellido].filter(Boolean).join(" ").trim();

  const codigoPostalCrudo = campos.get("Código Postal") ?? "";
  const codigoPostal = codigoPostalCrudo.match(/\d{5}/)?.[0] ?? "";

  const direccionFiscal = [
    [campos.get("Tipo de Vialidad"), campos.get("Nombre de Vialidad")].filter(Boolean).join(" "),
    campos.get("Número Exterior") ? `No. ${campos.get("Número Exterior")}` : "",
    campos.get("Número Interior") ? `Int. ${campos.get("Número Interior")}` : "",
    campos.get("Nombre de la Colonia") ? `Col. ${campos.get("Nombre de la Colonia")}` : "",
    campos.get("Nombre del Municipio o Demarcación Territorial"),
    campos.get("Nombre de la Entidad Federativa"),
    codigoPostal ? `C.P. ${codigoPostal}` : "",
  ]
    .filter((parte) => parte && parte.trim())
    .join(", ");

  const emailCrudo = campos.get("Correo electrónico") ?? "";
  const email = emailCrudo.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]?.toLowerCase() ?? "";

  const telefono = (campos.get("Número") ?? "").match(/\d{7,10}/)?.[0] ?? "";

  const regimenesDetectados = detectarRegimenes(texto);

  const faltantes: string[] = [];
  if (!rfc || !esRfcValido(rfc)) faltantes.push("RFC");
  if (!razonSocial) faltantes.push("razón social");
  if (!codigoPostal) faltantes.push("código postal");
  if (regimenesDetectados.length === 0) faltantes.push("régimen fiscal");

  return {
    rfc: esRfcValido(rfc) ? rfc : "",
    razonSocial,
    regimenFiscal: regimenesDetectados[0]?.clave ?? "",
    regimenesDetectados,
    codigoPostal,
    direccionFiscal,
    email,
    telefono,
    faltantes,
  };
}

export async function leerConstancia(buffer: Buffer) {
  const texto = await extraerTextoPdf(buffer);
  return parsearConstancia(texto);
}
