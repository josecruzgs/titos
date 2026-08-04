import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Configuracion from "@/models/Configuracion";
import { DIAS_SEMANA } from "@/lib/dias";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";

async function obtenerConfiguracion() {
  let config = await Configuracion.findOne();
  if (!config) config = await Configuracion.create({});
  return config;
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  await connectDB();
  const config = await obtenerConfiguracion();

  // Las sucursales solo necesitan el tipo de cambio (lo usa el punto de venta)
  if (session.role !== "matriz") {
    return NextResponse.json({ tipoCambio: config.tipoCambio ?? 17 });
  }

  return NextResponse.json(config);
}

export async function PATCH(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Cuerpo inválido");

  const update: Record<string, unknown> = {};
  if ("diasLaborales" in body) {
    if (!Array.isArray(body.diasLaborales) || body.diasLaborales.some((d: unknown) => !DIAS_SEMANA.includes(d as typeof DIAS_SEMANA[number]))) {
      return badRequest("Días laborales inválidos");
    }
    update.diasLaborales = body.diasLaborales;
  }
  if ("horaCorte" in body) {
    if (!/^\d{2}:\d{2}$/.test(body.horaCorte)) return badRequest("Hora de corte inválida (usa formato HH:MM)");
    update.horaCorte = body.horaCorte;
  }
  if ("tipoCambio" in body) {
    const tipoCambio = Number(body.tipoCambio);
    if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) return badRequest("Tipo de cambio inválido");
    update.tipoCambio = tipoCambio;
  }

  await connectDB();
  const actual = await obtenerConfiguracion();
  Object.assign(actual, update);
  await actual.save();

  return NextResponse.json(actual);
}
