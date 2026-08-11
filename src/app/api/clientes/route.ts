import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Cliente from "@/models/Cliente";
import CuentaPorCobrar from "@/models/CuentaPorCobrar";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";
import { parseClienteBody } from "@/lib/clientes";
import { resumenCredito, zonaHorariaDeSucursal, type CuentaLike } from "@/lib/credito";
import { contextoPuntoVenta, sucursalConsultada } from "@/lib/puntoVenta";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  const url = new URL(req.url);

  await connectDB();

  // La sucursal solo ve su cartera; matriz la de la sucursal que indique o, si
  // no indica ninguna, la de su propio mostrador.
  const sucursalId = await sucursalConsultada(session, url);
  if (!sucursalId) return forbidden();

  const filtro: Record<string, unknown> = { sucursalId };
  if (url.searchParams.get("soloActivos") === "1") filtro.activo = true;

  const clientes = await Cliente.find(filtro).sort({ nombre: 1 }).lean();
  const cuentas = await CuentaPorCobrar.find({
    clienteId: { $in: clientes.map((c) => c._id) },
    estado: "pendiente",
  }).lean();

  const cuentasPorCliente = new Map<string, CuentaLike[]>();
  for (const cuenta of cuentas) {
    const key = String(cuenta.clienteId);
    const lista = cuentasPorCliente.get(key) ?? [];
    lista.push(cuenta as unknown as CuentaLike);
    cuentasPorCliente.set(key, lista);
  }

  const zonaHoraria = await zonaHorariaDeSucursal(sucursalId);
  const ahora = new Date();

  return NextResponse.json(
    clientes.map((cliente) => ({
      ...cliente,
      resumen: resumenCredito(cliente, cuentasPorCliente.get(String(cliente._id)) ?? [], zonaHoraria, ahora),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Cuerpo inválido");

  const parsed = parseClienteBody(body);
  if ("error" in parsed) return badRequest(parsed.error);

  await connectDB();

  const ctx = await contextoPuntoVenta(session);
  if (!ctx) return forbidden();

  const cliente = await Cliente.create({ ...parsed.data, sucursalId: ctx.sucursalId, saldo: 0 });
  return NextResponse.json(cliente, { status: 201 });
}
