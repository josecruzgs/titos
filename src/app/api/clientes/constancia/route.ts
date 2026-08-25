import { NextRequest, NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest } from "@/lib/apiAuth";
import { extraerTextoPdf, parsearConstancia, type DatosConstancia } from "@/lib/constanciaFiscal";
import { leerConstanciaConIA } from "@/lib/constanciaIA";

// pdfjs necesita el runtime de Node (no corre en el edge).
export const runtime = "nodejs";

// Leer un escaneo con la IA tarda bastante más que extraer texto con pdfjs.
export const maxDuration = 60;

const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB

function sirve(datos: DatosConstancia) {
  return Boolean(datos.rfc || datos.razonSocial);
}

/**
 * Lee el PDF de la Constancia de Situación Fiscal y devuelve los datos fiscales
 * ya interpretados. No da de alta nada: el alta la confirma el usuario en el
 * formulario de clientes, con los datos precargados.
 *
 * Se intenta primero con pdfjs, que es gratis e instantáneo pero solo sirve si
 * el PDF trae capa de texto. Buena parte de las constancias llegan escaneadas o
 * fotografiadas, y de esas pdfjs saca cero caracteres; para esas se recurre a
 * la IA, que sí lee la página como imagen.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  let archivo: File | null = null;
  try {
    const form = await req.formData();
    const valor = form.get("archivo");
    if (valor instanceof File) archivo = valor;
  } catch {
    return badRequest("No se pudo leer el archivo enviado");
  }

  if (!archivo) return badRequest("Adjunta el PDF de la constancia de situación fiscal");
  if (archivo.size === 0) return badRequest("El archivo está vacío");
  if (archivo.size > TAMANO_MAXIMO) return badRequest("El PDF no debe pesar más de 10 MB");
  if (!archivo.name.toLowerCase().endsWith(".pdf") && archivo.type !== "application/pdf") {
    return badRequest("El archivo debe ser un PDF");
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());

  // Paso 1: capa de texto. Si el PDF la trae, esto resuelve sin costo.
  let textoExtraido = "";
  try {
    textoExtraido = await extraerTextoPdf(buffer);
    const datos = parsearConstancia(textoExtraido);
    if (sirve(datos)) return NextResponse.json({ ...datos, origen: "texto" });
  } catch (err) {
    // Un PDF corrupto o protegido truena aquí; la IA todavía puede sacarlo
    // adelante, así que no se corta el flujo.
    console.error("pdfjs no pudo leer la constancia:", err);
  }

  // Paso 2: la IA. Es el único camino cuando el PDF es un escaneo.
  if (!process.env.ANTHROPIC_API_KEY) {
    return badRequest(
      textoExtraido.trim()
        ? "No se reconocieron los datos fiscales en el PDF. Verifica que sea la constancia de situación fiscal del SAT."
        : "El PDF viene escaneado y no trae texto que se pueda leer. Configura ANTHROPIC_API_KEY para leer constancias escaneadas, o captura los datos a mano."
    );
  }

  try {
    const datos = await leerConstanciaConIA(buffer);
    if (!sirve(datos)) {
      return badRequest(
        "No se reconocieron los datos fiscales en el PDF. Verifica que sea la constancia de situación fiscal del SAT."
      );
    }
    return NextResponse.json({ ...datos, origen: "ia" });
  } catch (err) {
    console.error("La IA no pudo leer la constancia fiscal:", err);
    return badRequest("No se pudo leer el PDF. Puede estar protegido o dañado.");
  }
}
