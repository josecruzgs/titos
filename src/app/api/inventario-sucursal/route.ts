import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import InventarioSucursal from "@/models/InventarioSucursal";
import Producto from "@/models/Producto";
import { requireSession, unauthorized, forbidden } from "@/lib/apiAuth";
import { contextoPuntoVenta } from "@/lib/puntoVenta";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  await connectDB();

  const ctx = await contextoPuntoVenta(session);
  if (!ctx) return forbidden();

  // En el mostrador de matriz lo que se vende es la existencia del CEDIS, que
  // vive en el propio producto y no en un InventarioSucursal.
  if (ctx.esMatriz) {
    const productos = await Producto.find({ activo: true })
      .select("existenciaMatriz stockMinimo stockMaximo")
      .lean();

    return NextResponse.json(
      productos.map((p) => ({
        productoId: String(p._id),
        stockActual: p.existenciaMatriz ?? 0,
        stockMinimo: p.stockMinimo ?? 0,
        stockMaximo: p.stockMaximo ?? 0,
      }))
    );
  }

  const inventario = await InventarioSucursal.find({ sucursalId: ctx.sucursalId })
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
