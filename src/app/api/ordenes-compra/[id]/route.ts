import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import OrdenCompra from "@/models/OrdenCompra";
import NecesidadCompra from "@/models/NecesidadCompra";
import { requireSession, unauthorized, forbidden, badRequest, notFound } from "@/lib/apiAuth";

type ItemInput = {
  productoId: string;
  nombreProducto: string;
  cantidadRequerida?: number | null;
  cantidadOrdenada: number;
  precioUnitario?: number;
  necesidadId?: string | null;
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const items: ItemInput[] = body?.items ?? [];

  if (items.length === 0) return badRequest("La orden debe tener al menos un producto");
  for (const item of items) {
    if (!item.productoId || !item.cantidadOrdenada || item.cantidadOrdenada <= 0) {
      return badRequest("Cada producto debe tener una cantidad a ordenar mayor a 0");
    }
  }

  await connectDB();
  const orden = await OrdenCompra.findById(id);
  if (!orden) return notFound("Orden de compra no encontrada");
  if (orden.estado !== "borrador") {
    return badRequest("Sólo se pueden editar los productos de una orden en borrador");
  }

  type OrdenItemDoc = (typeof orden.items)[number];
  const idsAntes = new Set(orden.items.map((i: OrdenItemDoc) => String(i.productoId)));
  const idsDespues = new Set(items.map((i) => i.productoId));
  const necesidadesALiberar = orden.items
    .filter((i: OrdenItemDoc) => i.necesidadId && !idsDespues.has(String(i.productoId)))
    .map((i: OrdenItemDoc) => i.necesidadId);

  orden.items = items.map((i) => ({
    productoId: i.productoId,
    nombreProducto: i.nombreProducto,
    cantidadRequerida: i.cantidadRequerida ?? null,
    cantidadOrdenada: i.cantidadOrdenada,
    precioUnitario: Number(i.precioUnitario) || 0,
    necesidadId: idsAntes.has(i.productoId) ? (i.necesidadId ?? null) : null,
  })) as typeof orden.items;

  await orden.save();

  if (necesidadesALiberar.length > 0) {
    await NecesidadCompra.updateMany(
      { _id: { $in: necesidadesALiberar } },
      { estado: "pendiente", ordenCompraId: null }
    );
  }

  return NextResponse.json(orden);
}
