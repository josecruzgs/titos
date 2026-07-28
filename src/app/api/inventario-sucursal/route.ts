import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import InventarioSucursal from "@/models/InventarioSucursal";
import { requireSession, unauthorized, forbidden } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  await connectDB();

  const inventario = await InventarioSucursal.find({ sucursalId: session.sucursalId })
    .select("productoId stockActual stockMinimo stockMaximo")
    .lean();

  return NextResponse.json(
    inventario.map((i) => ({
      productoId: String(i.productoId),
      stockActual: i.stockActual,
      stockMinimo: i.stockMinimo,
      stockMaximo: i.stockMaximo,
    }))
  );
}
