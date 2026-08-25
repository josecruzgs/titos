import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Sucursal from "@/models/Sucursal";
import Ventas2Activacion from "@/models/Ventas2Activacion";
import "@/models/Venta";
import { requireSession, unauthorized, forbidden, badRequest, conflict } from "@/lib/apiAuth";
import { resumirActivacionesVentas2, sincronizarVentas2 } from "@/lib/ventas2";

function parseFecha(value: unknown) {
  if (typeof value !== "string") return null;
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  await connectDB();
  const ahora = new Date();
  await sincronizarVentas2(ahora);

  const url = new URL(req.url);
  const estado = url.searchParams.get("estado");
  const filter: Record<string, unknown> = {};

  if (session.role === "sucursal") {
    if (!session.sucursalId) return forbidden();
    filter.sucursalId = session.sucursalId;
  } else if (session.role !== "matriz") {
    return forbidden();
  }

  if (estado && ["programada", "activa", "finalizada", "cancelada"].includes(estado)) {
    filter.estado = estado;
  } else {
    filter.estado = { $ne: "cancelada" };
  }

  const activaciones = await Ventas2Activacion.find(filter)
    .sort({ inicio: -1 })
    .limit(session.role === "matriz" ? 300 : 100)
    .populate("sucursalId", "nombre")
    .lean();

  const resumen = await resumirActivacionesVentas2(activaciones, ahora);
  return NextResponse.json({ activaciones: resumen });
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  const sucursalIds: string[] = Array.isArray(body?.sucursalIds) ? body.sucursalIds.map(String).filter(Boolean) : [];
  const inicio = parseFecha(body?.inicio);
  // Sin fecha de fin el protocolo queda indefinido: corre hasta que matriz lo
  // detenga a mano desde esta misma pantalla.
  const indefinido = body?.indefinido === true || body?.fin === null;
  const fin = indefinido ? null : parseFecha(body?.fin);
  const frecuencia = Number(body?.frecuencia);

  if (sucursalIds.length === 0) return badRequest("Selecciona al menos una sucursal");
  if (!inicio) return badRequest("Captura la fecha y hora de inicio");
  if (!indefinido && (!fin || fin <= inicio)) return badRequest("Captura un lapso valido para Ventas 2");
  if (!Number.isInteger(frecuencia) || frecuencia < 2) return badRequest("La frecuencia debe ser un numero entero mayor o igual a 2");

  await connectDB();

  const sucursales = await Sucursal.find({ _id: { $in: sucursalIds }, activo: true }).select("_id").lean();
  const sucursalesValidas = new Set<string>(sucursales.map((s) => String(s._id)));
  const idsValidos = sucursalIds.filter((id: string) => sucursalesValidas.has(id));
  if (idsValidos.length === 0) return badRequest("No se encontraron sucursales activas para activar Ventas 2");

  // Dos activaciones se cruzan si cada una empieza antes de que acabe la otra.
  // Una indefinida no tiene fin, asi que se cruza con todo lo que venga despues.
  const overlap = await Ventas2Activacion.findOne({
    sucursalId: { $in: idsValidos },
    estado: { $ne: "cancelada" },
    ...(fin ? { inicio: { $lt: fin } } : {}),
    $or: [{ fin: null }, { fin: { $gt: inicio } }],
  })
    .populate("sucursalId", "nombre")
    .lean();

  if (overlap) {
    const sucursal = overlap.sucursalId as unknown as { nombre?: string };
    return conflict(`Ya existe una activacion de Ventas 2 que se cruza con ese lapso en ${sucursal?.nombre ?? "una sucursal"}`);
  }

  const docs = await Ventas2Activacion.insertMany(
    idsValidos.map((sucursalId: string) => ({
      sucursalId,
      inicio,
      fin,
      frecuencia,
      creadoPorId: session.userId,
    }))
  );

  await sincronizarVentas2(new Date());

  return NextResponse.json({ activaciones: docs.map((d) => String(d._id)) }, { status: 201 });
}
