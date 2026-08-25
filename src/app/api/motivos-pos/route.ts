import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import MotivoPos from "@/models/MotivoPos";
import { requireSession, unauthorized, forbidden, badRequest, conflict } from "@/lib/apiAuth";
import { esTipoMotivoPos, normalizarMotivo } from "@/lib/motivosPos";

/**
 * Catálogo de motivos de cancelación y devolución. Lo consultan los puntos de
 * venta de matriz y de las sucursales, así que lo puede leer cualquier sesión;
 * darlos de alta es solo de matriz.
 *
 * Por omisión solo devuelve los activos: eso es lo que necesita el mostrador.
 * Configuración pide `?incluirInactivos=1` para poder reactivarlos.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  await connectDB();

  const url = new URL(req.url);
  const filtro: Record<string, unknown> = {};

  const tipo = url.searchParams.get("tipo");
  if (tipo) {
    if (!esTipoMotivoPos(tipo)) return badRequest("Tipo de motivo inválido");
    filtro.tipo = tipo;
  }

  const incluirInactivos = url.searchParams.get("incluirInactivos") === "1" && session.role === "matriz";
  if (!incluirInactivos) filtro.activo = true;

  const motivos = await MotivoPos.find(filtro).sort({ tipo: 1, orden: 1, texto: 1 }).lean();

  return NextResponse.json(motivos.map((m) => ({ ...m, _id: String(m._id) })));
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  const tipo = body?.tipo;
  const texto = normalizarMotivo(body?.texto);

  if (!esTipoMotivoPos(tipo)) return badRequest("Indica si el motivo es de cancelación o de devolución");
  if (!texto) return badRequest("Captura el texto del motivo");

  await connectDB();

  // El orden por omisión manda el motivo nuevo al final de su lista.
  const ultimo = await MotivoPos.findOne({ tipo }).sort({ orden: -1 }).select("orden").lean();
  const orden = Number((ultimo as { orden?: number } | null)?.orden ?? 0) + 1;

  try {
    const motivo = await MotivoPos.create({ tipo, texto, orden });
    return NextResponse.json({ ...motivo.toObject(), _id: String(motivo._id) }, { status: 201 });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return conflict("Ese motivo ya existe para este tipo");
    throw err;
  }
}
