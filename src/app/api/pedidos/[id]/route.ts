import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Pedido from "@/models/Pedido";
import "@/models/Sucursal"; // necesario para que populate("sucursalId") funcione
import { requireSession, unauthorized, forbidden, notFound } from "@/lib/apiAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  const { id } = await params;
  await connectDB();

  const pedido = await Pedido.findById(id).populate("sucursalId", "nombre").lean();
  if (!pedido) return notFound("Pedido no encontrado");

  if (session.role === "sucursal" && String(pedido.sucursalId?._id ?? pedido.sucursalId) !== session.sucursalId) {
    return forbidden();
  }

  return NextResponse.json(pedido);
}
