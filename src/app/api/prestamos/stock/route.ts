import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Producto from "@/models/Producto";
import Sucursal from "@/models/Sucursal";
import InventarioSucursal from "@/models/InventarioSucursal";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";

/**
 * Stock de un producto en las demás sucursales, para saber a quién pedirle
 * prestado cuando aquí se está acabando.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return badRequest("Escribe al menos 2 caracteres para buscar");

  await connectDB();

  const patron = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const productos = await Producto.find({
    activo: true,
    $or: [{ nombre: patron }, { sku: patron }, { alias: patron }],
  })
    .select("sku nombre unidad")
    .limit(25)
    .lean();

  if (productos.length === 0) return NextResponse.json({ productos: [] });

  const productoIds = productos.map((p) => p._id);
  const [sucursales, inventarios] = await Promise.all([
    Sucursal.find({ activo: true }).select("nombre").sort({ nombre: 1 }).lean(),
    InventarioSucursal.find({ productoId: { $in: productoIds } }).select("sucursalId productoId stockActual").lean(),
  ]);

  const stockPorLlave = new Map(
    inventarios.map((i) => [`${String(i.productoId)}|${String(i.sucursalId)}`, i.stockActual])
  );

  return NextResponse.json({
    productos: productos.map((p) => ({
      _id: String(p._id),
      sku: p.sku,
      nombre: p.nombre,
      unidad: p.unidad,
      stockPropio: stockPorLlave.get(`${String(p._id)}|${String(session.sucursalId)}`) ?? 0,
      otrasSucursales: sucursales
        .filter((s) => String(s._id) !== String(session.sucursalId))
        .map((s) => ({
          sucursalId: String(s._id),
          nombre: s.nombre,
          stockActual: stockPorLlave.get(`${String(p._id)}|${String(s._id)}`) ?? 0,
        })),
    })),
  });
}
