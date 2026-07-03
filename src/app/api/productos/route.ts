import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Producto from "@/models/Producto";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  await connectDB();
  const productos = await Producto.find({ activo: true }).sort({ nombre: 1 }).lean();
  return NextResponse.json(productos);
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  if (!body?.sku || !body?.nombre || !body?.categoria || !body?.unidad) {
    return badRequest("Faltan campos requeridos (sku, nombre, categoria, unidad)");
  }

  await connectDB();
  const producto = await Producto.create({
    sku: body.sku,
    nombre: body.nombre,
    categoria: body.categoria,
    unidad: body.unidad,
    requierePesaje: Boolean(body.requierePesaje),
    precioCompra: Number(body.precioCompra) || 0,
    precioVenta: Number(body.precioVenta) || 0,
    existenciaMatriz: Number(body.existenciaMatriz) || 0,
    stockMinimo: Number(body.stockMinimo) || 0,
  });

  return NextResponse.json(producto, { status: 201 });
}
