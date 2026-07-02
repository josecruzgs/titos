import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import OrdenCompra from "@/models/OrdenCompra";
import { requireSession, unauthorized, forbidden, badRequest, notFound } from "@/lib/apiAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const { id } = await params;
  await connectDB();

  const orden = await OrdenCompra.findById(id);
  if (!orden) return notFound("Orden de compra no encontrada");
  if (orden.estado !== "borrador") {
    return badRequest("Sólo se pueden solicitar las órdenes en estado 'borrador'");
  }

  orden.estado = "solicitada";
  orden.fechaSolicitud = new Date();
  await orden.save();

  return NextResponse.json(orden);
}
