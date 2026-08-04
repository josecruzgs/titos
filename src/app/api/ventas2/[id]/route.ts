import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Ventas2Activacion from "@/models/Ventas2Activacion";
import { requireSession, unauthorized, forbidden, badRequest, notFound } from "@/lib/apiAuth";
import { sincronizarVentas2 } from "@/lib/ventas2";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  const accion = String(body?.accion ?? "");
  const { id } = await params;

  await connectDB();

  const activacion = await Ventas2Activacion.findById(id);
  if (!activacion) return notFound("Activacion de Ventas 2 no encontrada");
  if (activacion.estado === "cancelada") return badRequest("Esta activacion ya fue cancelada");

  if (accion === "terminar") {
    const ahora = new Date();
    if (activacion.fin > ahora) activacion.fin = ahora;
    activacion.estado = "finalizada";
    activacion.finalizadoManualPorId = session.userId;
    activacion.finalizadoManualEn = ahora;
    await activacion.save();
    await sincronizarVentas2(ahora);
    return NextResponse.json({ ok: true });
  }

  if (accion === "retirar") {
    if (!activacion.retiradoEn) {
      activacion.retiradoEn = new Date();
      activacion.retiradoPorId = session.userId;
      await activacion.save();
    }
    return NextResponse.json({ ok: true });
  }

  if (accion === "cancelar") {
    if (activacion.estado === "finalizada") return badRequest("No puedes cancelar una activacion finalizada");
    activacion.estado = "cancelada";
    await activacion.save();
    return NextResponse.json({ ok: true });
  }

  return badRequest("Accion invalida");
}
