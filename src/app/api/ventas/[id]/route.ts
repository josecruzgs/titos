import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Venta from "@/models/Venta";
import "@/models/Sucursal"; // necesario para que populate("sucursalId") funcione
import { requireSession, unauthorized, forbidden, notFound } from "@/lib/apiAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  const { id } = await params;
  await connectDB();

  const venta = await Venta.findById(id);
  if (!venta) return notFound("Venta no encontrada");
  if (session.role === "sucursal" && String(venta.sucursalId) !== session.sucursalId) return forbidden();

  await venta.populate("sucursalId", "nombre");
  return NextResponse.json(venta);
}
