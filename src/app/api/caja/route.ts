import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CajaSesion from "@/models/CajaSesion";
import "@/models/Sucursal"; // necesario para que populate("sucursalId") funcione
import "@/models/User"; // necesario para que populate("usuarioAperturaId"/"usuarioCierreId") funcione
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
    const sucursalId = url.searchParams.get("sucursalId");
    if (sucursalId) filter.sucursalId = sucursalId;
  }

  const sesiones = await CajaSesion.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("sucursalId", "nombre")
    .populate("usuarioAperturaId", "nombre")
    .populate("usuarioCierreId", "nombre")
    .lean();

  return NextResponse.json(sesiones);
}
