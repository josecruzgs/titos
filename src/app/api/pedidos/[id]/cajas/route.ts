import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Pedido from "@/models/Pedido";
import { requireSession, unauthorized, forbidden, badRequest, notFound } from "@/lib/apiAuth";

type ItemCaja = { productoId: string; nombreProducto: string; cantidad: number };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const numero = body?.numero;
  const cincho1 = body?.cincho1;
  const cincho2 = body?.cincho2;
  const categoria = body?.categoria || "";
  const items: ItemCaja[] = body?.items ?? [];

  if (!numero) {
    return badRequest("Captura el número de la caja");
  }
  if (!cincho1 || !cincho2) {
    return badRequest("Se requieren los dos números de cincho para sellar la caja");
  }
  if (items.length === 0) {
    return badRequest("La caja debe tener al menos un producto");
  }

  await connectDB();
  const pedido = await Pedido.findById(id);
  if (!pedido) return notFound("Pedido no encontrado");

  type CajaDoc = (typeof pedido.cajas)[number];
  if (pedido.cajas.some((c: CajaDoc) => c.numero === String(numero))) {
    return badRequest(`Ya existe una caja con el número ${numero} en este pedido`);
  }

  pedido.cajas.push({
    numero: String(numero),
    cincho1,
    cincho2,
    categoria,
    items: items.map((i) => ({
      productoId: i.productoId,
      nombreProducto: i.nombreProducto,
      cantidad: i.cantidad,
    })),
  });

  await pedido.save();

  return NextResponse.json(pedido, { status: 201 });
}
