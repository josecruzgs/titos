import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import NecesidadCompra from "@/models/NecesidadCompra";
import { requireSession, unauthorized, forbidden } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  await connectDB();

  const url = new URL(req.url);
  const estado = url.searchParams.get("estado");
  const filter: Record<string, unknown> = {};
  if (estado) filter.estado = estado;

  const necesidades = await NecesidadCompra.find(filter).sort({ createdAt: 1 }).lean();
  return NextResponse.json(necesidades);
}
