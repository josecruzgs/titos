import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Factura from "@/models/Factura";
import { requireSession, unauthorized, forbidden, badRequest, notFound } from "@/lib/apiAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const { id } = await params;
  await connectDB();

  const factura = await Factura.findById(id).lean();
  if (!factura) return notFound("Factura no encontrada");

  return NextResponse.json(JSON.parse(JSON.stringify(factura)));
}

/**
 * Acciones sobre una factura ya generada:
 * - "comentar": agrega una nota al historial (aclaraciones, referencias, etc.).
 * - "cancelar": la marca como cancelada dejando el motivo.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  const accion = String(body?.accion ?? "");
  const { id } = await params;

  await connectDB();

  const factura = await Factura.findById(id);
  if (!factura) return notFound("Factura no encontrada");

  if (accion === "comentar") {
    const texto = String(body?.texto ?? "").trim();
    if (!texto) return badRequest("Escribe el comentario");
    if (texto.length > 2000) return badRequest("El comentario es demasiado largo");

    factura.comentarios.push({
      texto,
      usuarioId: session.userId,
      usuarioNombre: session.nombre,
      fecha: new Date(),
    });
    await factura.save();
    return NextResponse.json(JSON.parse(JSON.stringify(factura)));
  }

  if (accion === "cancelar") {
    if (factura.estado === "cancelada") return badRequest("Esta factura ya está cancelada");
    // Cuando exista el timbrado, cancelar una factura ya timbrada tendrá que
    // pasar además por el acuse de cancelación del SAT.
    if (factura.timbrado?.estado === "timbrada") {
      return badRequest("Esta factura ya está timbrada: primero hay que cancelarla ante el SAT");
    }

    const motivo = String(body?.motivo ?? "").trim();
    if (!motivo) return badRequest("Captura el motivo de la cancelación");

    factura.estado = "cancelada";
    factura.motivoCancelacion = motivo;
    factura.canceladaEn = new Date();
    factura.canceladaPorId = session.userId;
    await factura.save();
    return NextResponse.json(JSON.parse(JSON.stringify(factura)));
  }

  return badRequest("Acción inválida");
}
