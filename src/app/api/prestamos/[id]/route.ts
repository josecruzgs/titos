import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import PrestamoSucursal from "@/models/PrestamoSucursal";
import InventarioSucursal from "@/models/InventarioSucursal";
import { requireSession, unauthorized, forbidden, badRequest, notFound, conflict } from "@/lib/apiAuth";
import { estaSaldado, moverStockPrestamo } from "@/lib/prestamos";

const ACCIONES = ["aprobar", "rechazar", "recibir", "devolver", "cancelar"] as const;
type Accion = (typeof ACCIONES)[number];

type CantidadPorProducto = { productoId: string; cantidad: number };

/** Mapa productoId → cantidad, tomando solo las cantidades positivas. */
function mapaCantidades(items: CantidadPorProducto[]) {
  const mapa = new Map<string, number>();
  for (const item of items ?? []) {
    const cantidad = Number(item.cantidad);
    if (Number.isFinite(cantidad) && cantidad > 0) mapa.set(String(item.productoId), cantidad);
  }
  return mapa;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  const { id } = await params;
  await connectDB();

  const prestamo = await PrestamoSucursal.findById(id).lean();
  if (!prestamo) return notFound("Préstamo no encontrado");

  const involucrada =
    session.role === "matriz" ||
    String(prestamo.sucursalSolicitanteId) === String(session.sucursalId) ||
    String(prestamo.sucursalPrestamistaId) === String(session.sucursalId);
  if (!involucrada) return forbidden();

  return NextResponse.json(prestamo);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const accion = String(body?.accion ?? "") as Accion;
  if (!ACCIONES.includes(accion)) return badRequest("Acción inválida");

  await connectDB();

  const prestamo = await PrestamoSucursal.findById(id);
  if (!prestamo) return notFound("Préstamo no encontrado");

  type PrestamoItem = (typeof prestamo.items)[number];
  const idsProductos = (prestamo.items as PrestamoItem[]).map((i) => i.productoId);

  const esSolicitante = String(prestamo.sucursalSolicitanteId) === String(session.sucursalId);
  const esPrestamista = String(prestamo.sucursalPrestamistaId) === String(session.sucursalId);
  if (!esSolicitante && !esPrestamista) return forbidden();

  const ahora = new Date();

  if (accion === "aprobar" || accion === "rechazar") {
    // Solo quien presta decide si suelta su mercancía.
    if (!esPrestamista) return forbidden();
    if (prestamo.estado !== "solicitado") return conflict("Esta solicitud ya fue resuelta");

    if (accion === "rechazar") {
      prestamo.estado = "rechazado";
      prestamo.motivoRechazo = String(body?.motivo ?? "").trim();
      prestamo.resueltoPorId = session.userId;
      prestamo.resueltoEn = ahora;
      await prestamo.save();
      return NextResponse.json(prestamo);
    }

    // Puede autorizar menos de lo solicitado; si no manda cantidades, autoriza todo.
    const autorizadas = mapaCantidades(body?.items ?? []);
    const inventarios = await InventarioSucursal.find({
      sucursalId: prestamo.sucursalPrestamistaId,
      productoId: { $in: idsProductos },
    }).lean();
    const stockPorProducto = new Map(inventarios.map((i) => [String(i.productoId), i.stockActual]));

    const sinStock: string[] = [];
    for (const item of prestamo.items) {
      const key = String(item.productoId);
      const cantidad = autorizadas.size > 0 ? (autorizadas.get(key) ?? 0) : item.cantidadSolicitada;
      if (cantidad - item.cantidadSolicitada > 0.0005) {
        return badRequest(`No puedes prestar más de lo solicitado de ${item.nombreProducto}`);
      }
      const stock = stockPorProducto.get(key) ?? 0;
      if (cantidad - stock > 0.0005) sinStock.push(`${item.nombreProducto} (tienes ${stock})`);
      item.cantidadEntregada = cantidad;
    }

    if (sinStock.length > 0) return conflict(`No tienes stock suficiente de: ${sinStock.join(", ")}`);
    if ((prestamo.items as PrestamoItem[]).every((i) => i.cantidadEntregada <= 0)) {
      return badRequest("Autoriza al menos un producto o rechaza la solicitud");
    }

    for (const item of prestamo.items) {
      if (item.cantidadEntregada <= 0) continue;
      await moverStockPrestamo({
        sucursalId: prestamo.sucursalPrestamistaId,
        productoId: item.productoId,
        nombreProducto: item.nombreProducto,
        delta: -item.cantidadEntregada,
        tipo: "salida_prestamo",
        prestamoId: prestamo._id,
        usuarioId: session.userId,
      });
    }

    prestamo.estado = "aprobado";
    prestamo.resueltoPorId = session.userId;
    prestamo.resueltoEn = ahora;
    await prestamo.save();
    return NextResponse.json(prestamo);
  }

  if (accion === "cancelar") {
    if (!esSolicitante) return forbidden();
    if (prestamo.estado !== "solicitado") return conflict("Solo puedes cancelar una solicitud que nadie ha resuelto");
    prestamo.estado = "cancelado";
    await prestamo.save();
    return NextResponse.json(prestamo);
  }

  if (accion === "recibir") {
    if (!esSolicitante) return forbidden();
    if (prestamo.estado !== "aprobado") return conflict("Este préstamo no está listo para recibirse");

    for (const item of prestamo.items) {
      if (item.cantidadEntregada <= 0) continue;
      await moverStockPrestamo({
        sucursalId: prestamo.sucursalSolicitanteId,
        productoId: item.productoId,
        nombreProducto: item.nombreProducto,
        delta: item.cantidadEntregada,
        tipo: "entrada_prestamo",
        prestamoId: prestamo._id,
        usuarioId: session.userId,
      });
    }

    prestamo.estado = "recibido";
    prestamo.recibidoPorId = session.userId;
    prestamo.recibidoEn = ahora;
    await prestamo.save();
    return NextResponse.json(prestamo);
  }

  // devolver: regresa mercancía a quien la prestó. Admite devoluciones parciales.
  if (!esSolicitante) return forbidden();
  if (prestamo.estado !== "recibido") return conflict("Solo puedes devolver un préstamo que ya recibiste");

  const aDevolver = mapaCantidades(body?.items ?? []);
  const inventarioPropio = await InventarioSucursal.find({
    sucursalId: prestamo.sucursalSolicitanteId,
    productoId: { $in: idsProductos },
  }).lean();
  const stockPropio = new Map(inventarioPropio.map((i) => [String(i.productoId), i.stockActual]));

  const movimientos: { item: PrestamoItem; cantidad: number }[] = [];
  const sinStock: string[] = [];

  for (const item of prestamo.items) {
    const key = String(item.productoId);
    const pendiente = Number((item.cantidadEntregada - item.cantidadDevuelta).toFixed(3));
    const cantidad = aDevolver.size > 0 ? (aDevolver.get(key) ?? 0) : pendiente;
    if (cantidad <= 0) continue;
    if (cantidad - pendiente > 0.0005) {
      return badRequest(`De ${item.nombreProducto} solo debes ${pendiente}`);
    }
    const stock = stockPropio.get(key) ?? 0;
    if (cantidad - stock > 0.0005) sinStock.push(`${item.nombreProducto} (tienes ${stock})`);
    movimientos.push({ item, cantidad });
  }

  if (movimientos.length === 0) return badRequest("Captura las cantidades que vas a devolver");
  if (sinStock.length > 0) return conflict(`No tienes stock suficiente para devolver: ${sinStock.join(", ")}`);

  for (const { item, cantidad } of movimientos) {
    await moverStockPrestamo({
      sucursalId: prestamo.sucursalSolicitanteId,
      productoId: item.productoId,
      nombreProducto: item.nombreProducto,
      delta: -cantidad,
      tipo: "salida_devolucion_prestamo",
      prestamoId: prestamo._id,
      usuarioId: session.userId,
    });
    await moverStockPrestamo({
      sucursalId: prestamo.sucursalPrestamistaId,
      productoId: item.productoId,
      nombreProducto: item.nombreProducto,
      delta: cantidad,
      tipo: "entrada_devolucion_prestamo",
      prestamoId: prestamo._id,
      usuarioId: session.userId,
    });
    item.cantidadDevuelta = Number((item.cantidadDevuelta + cantidad).toFixed(3));
  }

  if (estaSaldado(prestamo.items)) {
    prestamo.estado = "devuelto";
    prestamo.devueltoEn = ahora;
  }
  await prestamo.save();

  return NextResponse.json(prestamo);
}
