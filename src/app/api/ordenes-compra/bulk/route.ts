import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import OrdenCompra from "@/models/OrdenCompra";
import Proveedor from "@/models/Proveedor";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";
import { agregarItemAOrden, type ItemAAgregar } from "@/lib/ordenesCompra";

// Genera/actualiza en una sola pasada las órdenes de compra en borrador de
// varios proveedores a la vez, agrupando los items por proveedor (una orden
// por proveedor, igual que el flujo de un solo producto, pero en lote).
export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  const items: ItemAAgregar[] = Array.isArray(body?.items) ? body.items : [];

  if (items.length === 0) {
    return badRequest("No hay productos para generar órdenes de compra");
  }

  for (const item of items) {
    if (!item.proveedorId || !item.productoId || !(Number(item.cantidadOrdenada) > 0)) {
      return badRequest("Cada producto necesita proveedor y cantidad a ordenar (> 0)");
    }
  }

  await connectDB();

  const proveedorIds = [...new Set(items.map((i) => i.proveedorId))];
  const proveedoresExistentes = await Proveedor.find({ _id: { $in: proveedorIds } }).select("_id").lean();
  const idsValidos = new Set(proveedoresExistentes.map((p) => String(p._id)));
  const idsInvalidos = proveedorIds.filter((id) => !idsValidos.has(id));
  if (idsInvalidos.length > 0) {
    return badRequest(`Proveedor no encontrado: ${idsInvalidos.join(", ")}`);
  }

  const cache = new Map<string, InstanceType<typeof OrdenCompra>>();
  for (const item of items) {
    await agregarItemAOrden(cache, {
      proveedorId: item.proveedorId,
      productoId: item.productoId,
      cantidadOrdenada: Number(item.cantidadOrdenada),
      cantidadRequerida: item.cantidadRequerida ?? null,
      necesidadId: item.necesidadId ?? null,
    });
  }

  const ordenes = [...cache.values()];
  for (const orden of ordenes) {
    await orden.save();
  }

  return NextResponse.json({ ordenes }, { status: 201 });
}
