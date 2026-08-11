import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Devolucion from "@/models/Devolucion";
import CajaSesion from "@/models/CajaSesion";
import { requireSession, unauthorized, forbidden, badRequest, notFound, todayCorte } from "@/lib/apiAuth";
import { zonaHorariaDeSucursal } from "@/lib/credito";

/** Paga una devolución que quedó pendiente porque el corte de su día ya estaba cerrado. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  const { id } = await params;
  await connectDB();

  const devolucion = await Devolucion.findById(id);
  if (!devolucion || String(devolucion.sucursalId) !== String(session.sucursalId)) {
    return notFound("Devolución no encontrada");
  }
  if (devolucion.estado !== "pendiente") return badRequest("Esta devolución ya no está pendiente de pago");

  const sesionCaja = await CajaSesion.findOne({ sucursalId: session.sucursalId, estado: "abierta" });
  if (!sesionCaja) return badRequest("Debes abrir la caja para poder pagar la devolución");

  devolucion.estado = "pagada";
  devolucion.cajaSesionId = sesionCaja._id;
  devolucion.cortePago = todayCorte(await zonaHorariaDeSucursal(session.sucursalId));
  devolucion.pagadaEn = new Date();
  devolucion.pagadaPorId = session.userId;
  await devolucion.save();

  return NextResponse.json(devolucion);
}
