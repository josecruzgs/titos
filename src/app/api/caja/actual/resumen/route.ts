import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CajaSesion from "@/models/CajaSesion";
import { requireSession, unauthorized, forbidden, notFound } from "@/lib/apiAuth";
import { calcularResumenSesion } from "@/lib/caja";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  await connectDB();

  const sesion = await CajaSesion.findOne({ sucursalId: session.sucursalId, estado: "abierta" }).lean();
  if (!sesion) return notFound("No tienes una caja abierta");

  const resumen = await calcularResumenSesion(String(sesion._id));
  const efectivoEsperado = sesion.efectivoInicial + resumen.totalVentasEfectivo - resumen.totalRetiros;

  return NextResponse.json({ sesion, ...resumen, efectivoEsperado });
}
