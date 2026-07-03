import { NextRequest, NextResponse } from "next/server";
import { requireSession, unauthorized, forbidden } from "@/lib/apiAuth";
import { obtenerCodigoQR } from "@/lib/evolutionApi";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  try {
    const data = await obtenerCodigoQR();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
