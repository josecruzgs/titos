import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Pedido from "@/models/Pedido";
import "@/models/Sucursal"; // necesario para que populate("sucursalId") funcione
import { requireSession, unauthorized, forbidden } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  await connectDB();

  const url = new URL(req.url);
  const corte = url.searchParams.get("corte");
  const filter: Record<string, unknown> = { estado: { $ne: "pendiente" } };
  if (corte) filter.corte = corte;

  const pedidos = await Pedido.find(filter)
    .sort({ corte: -1, createdAt: -1 })
    .populate("sucursalId", "nombre")
    .lean();

  return NextResponse.json(pedidos);
}
