import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SolicitudProductoNuevo from "@/models/SolicitudProductoNuevo";
import "@/models/Sucursal"; // necesario para que populate("sucursalId") funcione
import { requireSession, unauthorized } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  await connectDB();

  const filter: Record<string, unknown> = {};
  if (session.role === "sucursal") {
    filter.sucursalId = session.sucursalId;
  } else {
    const url = new URL(req.url);
    const estado = url.searchParams.get("estado");
    if (estado) filter.estado = estado;
  }

  const solicitudes = await SolicitudProductoNuevo.find(filter)
    .sort({ createdAt: -1 })
    .populate("sucursalId", "nombre")
    .lean();

  return NextResponse.json(solicitudes);
}
