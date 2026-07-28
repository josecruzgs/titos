import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CajaSesion from "@/models/CajaSesion";
import MovimientoCaja from "@/models/MovimientoCaja";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  const body = await req.json().catch(() => null);
  const monto = Number(body?.monto);
  const motivo = String(body?.motivo ?? "").trim();

  if (!Number.isFinite(monto) || monto <= 0) return badRequest("Captura un monto válido a retirar");
  if (!motivo) return badRequest("Captura el motivo del retiro");

  await connectDB();

  const sesion = await CajaSesion.findOne({ sucursalId: session.sucursalId, estado: "abierta" });
  if (!sesion) return badRequest("Debes abrir la caja antes de retirar efectivo");

  const movimiento = await MovimientoCaja.create({
    cajaSesionId: sesion._id,
    sucursalId: session.sucursalId,
    tipo: "retiro",
    monto,
    motivo,
    usuarioId: session.userId,
  });

  return NextResponse.json(movimiento, { status: 201 });
}
