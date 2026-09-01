import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CajaSesion from "@/models/CajaSesion";
import { requireSession, unauthorized, forbidden, badRequest, conflict } from "@/lib/apiAuth";
import { contextoPuntoVenta } from "@/lib/puntoVenta";

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  const body = await req.json().catch(() => null);
  const efectivoInicial = Number(body?.efectivoInicial);
  if (!Number.isFinite(efectivoInicial) || efectivoInicial < 0) {
    return badRequest("Captura el efectivo inicial con el que abres la caja");
  }

  const efectivoInicialUsd = Number(body?.efectivoInicialUsd ?? 0);
  if (!Number.isFinite(efectivoInicialUsd) || efectivoInicialUsd < 0) {
    return badRequest("El fondo en dólares debe ser un monto válido");
  }

  const clienteOperacionId = body?.clienteOperacionId ? String(body.clienteOperacionId) : null;

  await connectDB();

  const ctx = await contextoPuntoVenta(session);
  if (!ctx) return forbidden();

  // Reintento de una apertura que el servidor ya había guardado (se cayó la red
  // antes de que llegara la respuesta): se devuelve la misma sesión.
  if (clienteOperacionId) {
    const yaAbierta = await CajaSesion.findOne({ clienteOperacionId });
    if (yaAbierta) return NextResponse.json(yaAbierta);
  }

  const existente = await CajaSesion.findOne({ sucursalId: ctx.sucursalId, estado: "abierta" });
  if (existente) return conflict("Ya tienes una caja abierta");

  try {
    const sesion = await CajaSesion.create({
      sucursalId: ctx.sucursalId,
      ...(clienteOperacionId ? { clienteOperacionId } : {}),
      usuarioAperturaId: session.userId,
      fechaApertura: new Date(),
      efectivoInicial,
      efectivoInicialUsd,
    });
    return NextResponse.json(sesion, { status: 201 });
  } catch (err) {
    const codigo = (err as { code?: number }).code;
    if (codigo === 11000 && clienteOperacionId) {
      const ganadora = await CajaSesion.findOne({ clienteOperacionId });
      if (ganadora) return NextResponse.json(ganadora);
    }
    throw err;
  }
}
