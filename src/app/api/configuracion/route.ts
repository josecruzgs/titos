import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { DIAS_SEMANA } from "@/lib/dias";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";
import { hashPassword } from "@/lib/auth";
import { NIP_SUPERVISOR_REGEX, obtenerConfiguracion } from "@/lib/configuracion";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  await connectDB();
  const config = await obtenerConfiguracion();
  const nipSupervisorConfigurado = !!config.nipSupervisorHash;

  // Las sucursales solo necesitan el tipo de cambio (lo usa el punto de venta) y
  // saber si ya hay un NIP de supervisor con el que autorizar cancelaciones.
  if (session.role !== "matriz") {
    return NextResponse.json({ tipoCambio: config.tipoCambio ?? 17, nipSupervisorConfigurado });
  }

  // El hash del NIP nunca sale de la API.
  const objeto = config.toObject();
  delete objeto.nipSupervisorHash;
  return NextResponse.json({ ...objeto, nipSupervisorConfigurado });
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
  if ("tasaIvaFactura" in body) {
    const tasa = Number(body.tasaIvaFactura);
    if (!Number.isFinite(tasa) || tasa < 0 || tasa > 100) return badRequest("La tasa de IVA debe ir de 0 a 100");
    update.tasaIvaFactura = tasa;
  }
  // `null` borra el NIP (deja las cancelaciones sin autorización); una cadena lo
  // cambia. Si no viene la llave, el NIP actual no se toca.
  if ("nipSupervisor" in body) {
    if (body.nipSupervisor === null) {
      update.nipSupervisorHash = "";
    } else {
      const nip = String(body.nipSupervisor ?? "").trim();
      if (!NIP_SUPERVISOR_REGEX.test(nip)) return badRequest("El NIP de supervisor debe tener de 4 a 8 dígitos");
      update.nipSupervisorHash = await hashPassword(nip);
    }
  }

  await connectDB();
  const actual = await obtenerConfiguracion();
  Object.assign(actual, update);
  await actual.save();

  const { nipSupervisorHash, ...resto } = actual.toObject();
  return NextResponse.json({ ...resto, nipSupervisorConfigurado: !!nipSupervisorHash });
}
