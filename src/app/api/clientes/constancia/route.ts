import { NextRequest, NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest } from "@/lib/apiAuth";
import { leerConstancia } from "@/lib/constanciaFiscal";

// pdfjs necesita el runtime de Node (no corre en el edge).
export const runtime = "nodejs";

const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB

/**
 * Lee el PDF de la Constancia de Situación Fiscal y devuelve los datos fiscales
 * ya interpretados. No da de alta nada: el alta la confirma el usuario en el
 * formulario de clientes, con los datos precargados.
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

  try {
    const datos = await leerConstancia(Buffer.from(await archivo.arrayBuffer()));

    if (!datos.rfc && !datos.razonSocial) {
      return badRequest(
        "No se reconocieron los datos fiscales en el PDF. Verifica que sea la constancia de situación fiscal del SAT."
      );
    }

    return NextResponse.json(datos);
  } catch (err) {
    console.error("No se pudo leer la constancia fiscal:", err);
    return badRequest("No se pudo leer el PDF. Puede estar protegido o dañado.");
  }
}
