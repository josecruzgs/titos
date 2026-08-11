import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Cliente from "@/models/Cliente";
import CuentaPorCobrar from "@/models/CuentaPorCobrar";
import AbonoCliente from "@/models/AbonoCliente";
import { requireSession, unauthorized, forbidden, notFound, badRequest, conflict } from "@/lib/apiAuth";
import { parseClienteBody } from "@/lib/clientes";
import { estaVencida, resumenCredito, zonaHorariaDeSucursal, type CuentaLike } from "@/lib/credito";

/** Carga el cliente verificando que pertenezca a la sucursal de la sesión. */
async function clienteDeLaSesion(id: string, sucursalId: string) {
  const cliente = await Cliente.findById(id);
  if (!cliente || String(cliente.sucursalId) !== String(sucursalId)) return null;
  return cliente;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  const { id } = await params;
  await connectDB();

  const cliente = await clienteDeLaSesion(id, session.sucursalId);
  if (!cliente) return notFound("Cliente no encontrado");

  const [cuentas, abonos] = await Promise.all([
    CuentaPorCobrar.find({ clienteId: id }).sort({ fecha: -1 }).lean(),
    AbonoCliente.find({ clienteId: id }).sort({ fecha: -1 }).limit(100).lean(),
  ]);

  const zonaHoraria = await zonaHorariaDeSucursal(session.sucursalId);
  const ahora = new Date();
  const pendientes = cuentas.filter((c) => c.estado === "pendiente") as unknown as CuentaLike[];

  return NextResponse.json({
    cliente,
    resumen: resumenCredito(cliente, pendientes, zonaHoraria, ahora),
    zonaHoraria,
    cuentas: cuentas.map((c) => ({
      ...c,
      vencida: c.estado === "pendiente" && estaVencida(c as unknown as CuentaLike, zonaHoraria, ahora),
    })),
    abonos,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Cuerpo inválido");

  const parsed = parseClienteBody(body, { parcial: true });
  if ("error" in parsed) return badRequest(parsed.error);

  await connectDB();

  const cliente = await clienteDeLaSesion(id, session.sucursalId);
  if (!cliente) return notFound("Cliente no encontrado");

  // Bajar el límite por debajo de lo que el cliente ya debe dejaría una cuenta
  // imposible de cuadrar; primero tiene que abonar.
  const nuevoLimite = parsed.data.credito?.limite;
  if (nuevoLimite != null && cliente.saldo - nuevoLimite > 0.005) {
    return conflict(
      `No puedes bajar el límite a ${nuevoLimite.toFixed(2)}: el cliente debe ${cliente.saldo.toFixed(2)}. Registra sus abonos primero.`
    );
  }

  Object.assign(cliente, parsed.data);
  await cliente.save();

  return NextResponse.json(cliente);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  const { id } = await params;
  await connectDB();

  const cliente = await clienteDeLaSesion(id, session.sucursalId);
  if (!cliente) return notFound("Cliente no encontrado");

  const conMovimientos = await CuentaPorCobrar.exists({ clienteId: id });
  if (conMovimientos) {
    return conflict(
      "Este cliente ya tiene ventas a crédito registradas y no se puede eliminar. Desactívalo en su lugar."
    );
  }

  await Cliente.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
