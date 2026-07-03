import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Pedido from "@/models/Pedido";
import { requireSession, unauthorized, forbidden, notFound } from "@/lib/apiAuth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; numero: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const { id, numero } = await params;

  await connectDB();
  const pedido = await Pedido.findById(id);
  if (!pedido) return notFound("Pedido no encontrado");

  type CajaDoc = (typeof pedido.cajas)[number];
  pedido.cajas = pedido.cajas.filter((c: CajaDoc) => c.numero !== numero) as typeof pedido.cajas;
  await pedido.save();

  return NextResponse.json(pedido);
}
