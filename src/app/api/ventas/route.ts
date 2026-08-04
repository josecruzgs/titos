import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Venta, { METODOS_PAGO } from "@/models/Venta";
import Producto from "@/models/Producto";
import InventarioSucursal from "@/models/InventarioSucursal";
import MovimientoInventario from "@/models/MovimientoInventario";
import CajaSesion from "@/models/CajaSesion";
import "@/models/Sucursal"; // necesario para que populate("sucursalId") funcione
import { requireSession, unauthorized, forbidden, badRequest, conflict, generateFolio, todayCorte } from "@/lib/apiAuth";
import { resolverVentas2ParaVenta } from "@/lib/ventas2";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  await connectDB();

  const filter: Record<string, unknown> = {};
  const url = new URL(req.url);
  const ventas2 = url.searchParams.get("ventas2");
  if (session.role === "sucursal") {
    filter.sucursalId = session.sucursalId;
  } else {
    const sucursalId = url.searchParams.get("sucursalId");
    const corte = url.searchParams.get("corte");
    if (sucursalId) filter.sucursalId = sucursalId;
    if (corte) filter.corte = corte;
  }
  if (ventas2 === "only") filter.esVentas2 = true;
  else if (ventas2 !== "include") filter.esVentas2 = { $ne: true };

  const ventas = await Venta.find(filter).sort({ createdAt: -1 }).populate("sucursalId", "nombre").lean();
  return NextResponse.json(ventas);
}

type ItemVenta = { productoId: string; cantidad: number };
type PagoVenta = { metodoPago: string; monto: number };

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "sucursal" || !session.sucursalId) return forbidden();

  const body = await req.json().catch(() => null);
  const items: ItemVenta[] = body?.items ?? [];
  const pagosBody: PagoVenta[] = body?.pagos ?? [];
  const montoRecibido = body?.montoRecibido != null ? Number(body.montoRecibido) : null;

  if (items.length === 0) return badRequest("La venta debe incluir al menos un producto");
  if (pagosBody.length === 0) return badRequest("Debes capturar al menos una forma de pago");

  const metodosUsados = new Set<string>();
  const pagos: PagoVenta[] = [];
  for (const p of pagosBody) {
    if (!METODOS_PAGO.includes(p.metodoPago as (typeof METODOS_PAGO)[number])) {
      return badRequest("Método de pago inválido");
    }
    if (metodosUsados.has(p.metodoPago)) {
      return badRequest("No repitas el mismo método de pago dos veces");
    }
    const monto = Number(p.monto);
    if (!monto || monto <= 0) return badRequest("Cada forma de pago debe tener un monto mayor a cero");
    metodosUsados.add(p.metodoPago);
    pagos.push({ metodoPago: p.metodoPago, monto });
  }

  const pagoEfectivo = pagos.find((p) => p.metodoPago === "efectivo");
  if (pagoEfectivo) {
    if (montoRecibido == null || montoRecibido < pagoEfectivo.monto) {
      return badRequest("El efectivo recibido debe ser mayor o igual a la parte pagada en efectivo");
    }
  } else if (montoRecibido != null) {
    return badRequest("No debes capturar efectivo recibido si no hay un pago en efectivo");
  }

  await connectDB();

  const sesionCaja = await CajaSesion.findOne({ sucursalId: session.sucursalId, estado: "abierta" });
  if (!sesionCaja) return badRequest("Debes abrir la caja antes de registrar ventas");

  const productoIds = items.map((i) => i.productoId);
  const productos = await Producto.find({ _id: { $in: productoIds }, activo: true });
  const productoMap = new Map(productos.map((p) => [String(p._id), p]));

  const inventarios = await InventarioSucursal.find({
    sucursalId: session.sucursalId,
    productoId: { $in: productoIds },
  });
  const inventarioMap = new Map(inventarios.map((i) => [String(i.productoId), i]));

  const ventaItems = [];
  const sinStock: string[] = [];
  let total = 0;

  for (const item of items) {
    const producto = productoMap.get(item.productoId);
    const cantidad = Number(item.cantidad);
    if (!producto || !cantidad || cantidad <= 0) {
      return badRequest("Producto inválido o cantidad inválida en la venta");
    }

    const stockActual = inventarioMap.get(item.productoId)?.stockActual ?? 0;
    if (stockActual < cantidad) {
      sinStock.push(`${producto.nombre} (disponible: ${stockActual})`);
      continue;
    }

    const subtotal = cantidad * producto.precioVenta;
    total += subtotal;
    ventaItems.push({
      productoId: producto._id,
      sku: producto.sku,
      nombreProducto: producto.nombre,
      unidad: producto.unidad,
      cantidad,
      precioUnitario: producto.precioVenta,
      subtotal,
    });
  }

  if (sinStock.length > 0) {
    return conflict(`Stock insuficiente para: ${sinStock.join(", ")}`);
  }

  const sumaPagos = pagos.reduce((sum, p) => sum + p.monto, 0);
  if (Math.abs(sumaPagos - total) > 0.01) {
    return badRequest(`La suma de las formas de pago (${sumaPagos.toFixed(2)}) no coincide con el total (${total.toFixed(2)})`);
  }

  const fechaVenta = new Date();
  const ventas2 = await resolverVentas2ParaVenta({
    sucursalId: session.sucursalId,
    pagos,
    fecha: fechaVenta,
  });

  const venta = await Venta.create({
    folio: generateFolio(ventas2.esVentas2 ? "V2" : "VTA"),
    sucursalId: session.sucursalId,
    cajaSesionId: sesionCaja._id,
    usuarioId: session.userId,
    fecha: fechaVenta,
    corte: todayCorte(),
    items: ventaItems,
    total,
    pagos,
    montoRecibido: pagoEfectivo ? montoRecibido : null,
    cambio: pagoEfectivo && montoRecibido != null ? Number((montoRecibido - pagoEfectivo.monto).toFixed(2)) : null,
    esVentas2: ventas2.esVentas2,
    ventas2ActivacionId: ventas2.activacionId,
    ventas2SecuenciaEfectivo: ventas2.secuenciaEfectivo,
  });

  for (const item of ventaItems) {
    await InventarioSucursal.findOneAndUpdate(
      { sucursalId: session.sucursalId, productoId: item.productoId },
      { $inc: { stockActual: -item.cantidad } }
    );
    await MovimientoInventario.create({
      tipo: "salida_venta",
      productoId: item.productoId,
      nombreProducto: item.nombreProducto,
      ubicacion: session.sucursalId,
      cantidad: item.cantidad,
      ventaId: venta._id,
      usuarioId: session.userId,
    });
  }

  return NextResponse.json(venta, { status: 201 });
}
