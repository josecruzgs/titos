import { NextRequest, NextResponse } from "next/server";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";
import { enviarWhatsApp } from "@/lib/evolutionApi";

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  const whatsapp = body?.whatsapp;
  const mensaje = body?.mensaje;

  if (!whatsapp || !mensaje) {
    return badRequest("El número de WhatsApp y el mensaje son requeridos");
  }

  try {
    await enviarWhatsApp(whatsapp, mensaje);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
