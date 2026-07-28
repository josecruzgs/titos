import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CajaSesion from "@/models/CajaSesion";
import "@/models/User"; // necesario para que populate("usuarioAperturaId") funcione
import { requireSession, unauthorized, forbidden } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  await connectDB();

  const sesion = await CajaSesion.findOne({ sucursalId: session.sucursalId, estado: "abierta" })
    .populate("usuarioAperturaId", "nombre")
    .lean();

  return NextResponse.json(sesion ?? null);
}
