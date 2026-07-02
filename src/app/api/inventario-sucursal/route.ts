import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import InventarioSucursal from "@/models/InventarioSucursal";
import "@/models/Producto"; // necesario para que populate("productoId") funcione
import { requireSession, unauthorized, forbidden } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  await connectDB();

  let sucursalId: string | null = null;
  if (session.role === "sucursal") {
    sucursalId = session.sucursalId;
  } else {
    const url = new URL(req.url);
    sucursalId = url.searchParams.get("sucursalId");
    if (!sucursalId) return forbidden();
  }

  const inventario = await InventarioSucursal.find({ sucursalId })
    .populate("productoId", "nombre sku unidad categoria requierePesaje")
    .sort({ "productoId.nombre": 1 })
    .lean();

  return NextResponse.json(inventario);
}
