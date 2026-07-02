import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import OrdenCompra from "@/models/OrdenCompra";
import NecesidadCompra from "@/models/NecesidadCompra";
import { requireSession, unauthorized, forbidden, badRequest, notFound } from "@/lib/apiAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const { id } = await params;
  await connectDB();

  const orden = await OrdenCompra.findById(id);
  if (!orden) return notFound("Orden de compra no encontrada");
  if (!["borrador", "solicitada"].includes(orden.estado)) {
    return badRequest("Sólo se pueden cancelar órdenes en borrador o ya solicitadas");
  }

  orden.estado = "cancelada";
  orden.fechaCancelacion = new Date();
  await orden.save();

  type OrdenItemDoc = (typeof orden.items)[number];
  const necesidadIds = orden.items.map((i: OrdenItemDoc) => i.necesidadId).filter(Boolean);
  if (necesidadIds.length > 0) {
    await NecesidadCompra.updateMany(
      { _id: { $in: necesidadIds } },
      { estado: "pendiente", ordenCompraId: null }
    );
  }

  return NextResponse.json(orden);
}
