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
    .populate("productoId", "nombre categoria unidad activo")
    .lean();

  const sugerencias = inventario
    .filter((i) => {
      const producto = i.productoId as unknown as { activo: boolean } | null;
      return producto?.activo && i.stockMaximo > 0 && i.stockActual <= i.stockMinimo;
    })
    .map((i) => {
      const producto = i.productoId as unknown as { _id: string; nombre: string; categoria: string; unidad: string };
      return {
        productoId: String(producto._id),
        nombre: producto.nombre,
        categoria: producto.categoria,
        unidad: producto.unidad,
        cantidadSugerida: i.stockMaximo - i.stockActual,
      };
    });

  return NextResponse.json(sugerencias);
}
