import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CajaSesion from "@/models/CajaSesion";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";
import { calcularResumenSesion } from "@/lib/caja";

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  const body = await req.json().catch(() => null);
  const efectivoContado = Number(body?.efectivoContado);
  const notas = String(body?.notas ?? "").trim();

  if (!Number.isFinite(efectivoContado) || efectivoContado < 0) {
    return badRequest("Captura el efectivo contado para cerrar la caja");
  }

  await connectDB();

  const sesion = await CajaSesion.findOne({ sucursalId: session.sucursalId, estado: "abierta" });
  if (!sesion) return badRequest("No tienes una caja abierta");

  const resumen = await calcularResumenSesion(String(sesion._id));
  const efectivoEsperado = sesion.efectivoInicial + resumen.totalVentasEfectivo - resumen.totalRetiros;

  sesion.estado = "cerrada";
  sesion.usuarioCierreId = session.userId;
  sesion.fechaCierre = new Date();
  sesion.totalVentasEfectivo = resumen.totalVentasEfectivo;
  sesion.totalVentasTarjeta = resumen.totalVentasTarjeta;
  sesion.totalVentasTransferencia = resumen.totalVentasTransferencia;
  sesion.totalRetiros = resumen.totalRetiros;
  sesion.efectivoEsperado = efectivoEsperado;
  sesion.efectivoContado = efectivoContado;
  sesion.diferencia = Number((efectivoContado - efectivoEsperado).toFixed(2));
  sesion.notas = notas;

  await sesion.save();

  return NextResponse.json(sesion);
}
