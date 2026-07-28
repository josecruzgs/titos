import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import OrdenCompra from "@/models/OrdenCompra";
import Proveedor from "@/models/Proveedor";
import Producto from "@/models/Producto";
import { requireSession, unauthorized, forbidden, badRequest, notFound } from "@/lib/apiAuth";
import { agregarItemAOrden } from "@/lib/ordenesCompra";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  await connectDB();
  const url = new URL(req.url);
  const estado = url.searchParams.get("estado");
  const filter: Record<string, unknown> = {};
  if (estado) filter.estado = estado;

  const ordenes = await OrdenCompra.find(filter).sort({ createdAt: -1 }).populate("proveedorId", "nombre whatsapp").lean();
  return NextResponse.json(ordenes);
}

// Agrega un producto a la orden en borrador del proveedor indicado. Si el
// proveedor no tiene una orden en borrador, se crea una nueva. Si el producto
// ya está en esa orden, se suma la cantidad en lugar de duplicar la línea.
export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  const proveedorId = body?.proveedorId;
  const productoId = body?.productoId;
  const cantidadOrdenada = Number(body?.cantidadOrdenada);
  const necesidadId: string | undefined = body?.necesidadId || undefined;

  if (!proveedorId) return badRequest("Selecciona un proveedor para la orden");
  if (!productoId || !cantidadOrdenada || cantidadOrdenada <= 0) {
    return badRequest("El producto y la cantidad a ordenar (> 0) son requeridos");
  }

  await connectDB();
  const proveedor = await Proveedor.findById(proveedorId);
  if (!proveedor) return notFound("Proveedor no encontrado");

  const producto = await Producto.findById(productoId);
  if (!producto) return notFound("Producto no encontrado");

  const cache = new Map<string, InstanceType<typeof OrdenCompra>>();
  const orden = await agregarItemAOrden(cache, {
    proveedorId,
    productoId,
    cantidadOrdenada,
    cantidadRequerida: body?.cantidadRequerida ?? null,
    necesidadId: necesidadId ?? null,
  });

  await orden.save();

  return NextResponse.json(orden, { status: 201 });
}
