import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Venta from "@/models/Venta";
import { requireSession, unauthorized, forbidden, badRequest, notFound } from "@/lib/apiAuth";
import { calcularDevolvible, dentroDeVentana, horasRestantes, HORAS_LIMITE_DEVOLUCION } from "@/lib/devoluciones";

/** Busca una venta por folio y devuelve qué se le puede devolver todavía. */
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  const folio = (new URL(req.url).searchParams.get("folio") ?? "").trim();
  if (!folio) return badRequest("Captura el folio de la venta");

  await connectDB();

  const venta = await Venta.findOne({
    folio: new RegExp(`^${folio.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    sucursalId: session.sucursalId,
  });
  if (!venta) return notFound("No se encontró una venta con ese folio en esta sucursal");

  const ahora = new Date();
  const items = await calcularDevolvible(venta._id, venta.items);
  const enVentana = dentroDeVentana(venta.fecha, ahora);

  return NextResponse.json({
    venta: {
      _id: String(venta._id),
      folio: venta.folio,
      fecha: venta.fecha,
      total: venta.total,
      estado: venta.estado,
      clienteNombre: venta.clienteNombre ?? "",
      pagos: venta.pagos,
    },
    items,
    enVentana,
    cancelada: venta.estado === "cancelada",
    horasRestantes: Number(horasRestantes(venta.fecha, ahora).toFixed(1)),
    horasLimite: HORAS_LIMITE_DEVOLUCION,
  });
}
