import Anthropic from "@anthropic-ai/sdk";
import type { DatosConstancia } from "@/lib/constanciaFiscal";
import { REGIMENES_POR_NOMBRE } from "@/lib/constanciaFiscal";
import { esRfcValido, normalizarRfc } from "@/lib/facturacion";

// Lectura de la Constancia de Situación Fiscal con Claude.
//
// Se usa como respaldo de la lectura con pdfjs: muchas constancias llegan
// escaneadas o fotografiadas, y esos PDFs no traen capa de texto, así que
// pdfjs extrae cero caracteres por más que el PDF esté sano. Claude sí lee la
// página como imagen, que es justo lo que hace falta ahí.

const MODELO = "claude-opus-5";

/** El SAT solo usa estas claves; acotar el enum evita que se invente una. */
const CLAVES_REGIMEN = REGIMENES_POR_NOMBRE.map((r) => r.clave);

const ESQUEMA = {
  type: "object" as const,
  properties: {
    rfc: { type: "string", description: "RFC del contribuyente, sin espacios ni guiones. Cadena vacía si no aparece." },
    razonSocial: {
      type: "string",
      description:
        "Denominación o razón social si es persona moral; si es persona física, el nombre completo (nombre y apellidos). Cadena vacía si no aparece.",
    },
    regimenFiscal: {
      type: "string",
      description: "Clave del régimen fiscal vigente. Si hay varios, el primero de la lista. Cadena vacía si no aparece.",
      enum: [...CLAVES_REGIMEN, ""],
    },
    codigoPostal: { type: "string", description: "Código postal del domicilio fiscal, 5 dígitos. Cadena vacía si no aparece." },
    direccionFiscal: {
      type: "string",
      description:
        "Domicilio fiscal en una línea: vialidad, número exterior e interior, colonia, municipio, estado y C.P. Cadena vacía si no aparece.",
    },
    email: { type: "string", description: "Correo electrónico registrado. Cadena vacía si no aparece." },
    telefono: { type: "string", description: "Teléfono registrado, solo dígitos. Cadena vacía si no aparece." },
  },
  required: ["rfc", "razonSocial", "regimenFiscal", "codigoPostal", "direccionFiscal", "email", "telefono"],
  additionalProperties: false,
};

const INSTRUCCIONES = [
  "Estás leyendo una Constancia de Situación Fiscal (CSF) emitida por el SAT de México.",
  "Extrae los datos fiscales exactamente como aparecen impresos; no los corrijas, completes ni adivines.",
  "Si un dato no aparece en el documento, devuelve cadena vacía en ese campo. Nunca inventes un valor.",
  "El documento puede venir escaneado o fotografiado: léelo visualmente.",
].join(" ");

/** Lee la constancia mandándole el PDF a Claude tal cual, sin extraer texto antes. */
export async function leerConstanciaConIA(buffer: Buffer): Promise<DatosConstancia> {
  const client = new Anthropic();

  const respuesta = await client.messages.create({
    model: MODELO,
    max_tokens: 4000,
    // Leer campos de un formulario no necesita razonamiento profundo, y el
    // effort alto por defecto duplicaba el tiempo de respuesta.
    output_config: { effort: "low" },
    system: INSTRUCCIONES,
    tools: [
      {
        name: "registrar_datos_fiscales",
        description: "Registra los datos fiscales leídos de la constancia.",
        strict: true,
        input_schema: ESQUEMA,
      },
    ],
    tool_choice: { type: "tool", name: "registrar_datos_fiscales" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
          },
          { type: "text", text: "Extrae los datos fiscales de esta constancia." },
        ],
      },
    ],
  });

  const bloque = respuesta.content.find((b) => b.type === "tool_use");
  if (!bloque || bloque.type !== "tool_use") {
    throw new Error("La IA no devolvió datos fiscales");
  }

  return normalizar(bloque.input as Record<string, unknown>);
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Los datos que devuelve la IA pasan por las mismas validaciones que los de
 * pdfjs: un RFC mal leído no debe llegar al formulario como si fuera bueno.
 */
function normalizar(crudo: Record<string, unknown>): DatosConstancia {
  const rfc = normalizarRfc(texto(crudo.rfc));
  const rfcValido = Boolean(rfc) && esRfcValido(rfc);

  const codigoPostal = texto(crudo.codigoPostal).match(/\d{5}/)?.[0] ?? "";
  const email = texto(crudo.email).match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]?.toLowerCase() ?? "";
  const telefono = texto(crudo.telefono).replace(/\D/g, "").match(/\d{7,10}/)?.[0] ?? "";
  const razonSocial = texto(crudo.razonSocial).replace(/\s+/g, " ");

  const clave = texto(crudo.regimenFiscal);
  const regimen = REGIMENES_POR_NOMBRE.find((r) => r.clave === clave);
  const regimenesDetectados = regimen ? [{ clave: regimen.clave, nombre: regimen.nombre }] : [];

  const faltantes: string[] = [];
  if (!rfcValido) faltantes.push("RFC");
  if (!razonSocial) faltantes.push("razón social");
  if (!codigoPostal) faltantes.push("código postal");
  if (regimenesDetectados.length === 0) faltantes.push("régimen fiscal");

  return {
    rfc: rfcValido ? rfc : "",
    razonSocial,
    regimenFiscal: regimen?.clave ?? "",
    regimenesDetectados,
    codigoPostal,
    direccionFiscal: texto(crudo.direccionFiscal).replace(/\s+/g, " "),
    email,
    telefono,
    faltantes,
  };
}
