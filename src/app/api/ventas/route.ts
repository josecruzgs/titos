import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Venta, { METODOS_PAGO } from "@/models/Venta";
import Producto from "@/models/Producto";
import MovimientoInventario from "@/models/MovimientoInventario";
import CajaSesion from "@/models/CajaSesion";
import Cliente from "@/models/Cliente";
import CuentaPorCobrar from "@/models/CuentaPorCobrar";
import "@/models/Sucursal"; // necesario para que populate("sucursalId") funcione
import { requireSession, unauthorized, forbidden, badRequest, conflict, todayCorte } from "@/lib/apiAuth";
import { siguienteFolio } from "@/lib/folios";
import { resolverVentas2ParaVenta } from "@/lib/ventas2";
import {
  ajustarStockPuntoVenta,
  contextoPuntoVenta,
  stockPuntoVenta,
  ubicacionDeMovimiento,
} from "@/lib/puntoVenta";
import {
  calcularVencimiento,
  motivoRechazoCredito,
  recalcularSaldoCliente,
  resumenCredito,
  zonaHorariaDeSucursal,
  type CuentaLike,
} from "@/lib/credito";

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

  const pagoCredito = pagos.find((p) => p.metodoPago === "credito");
  const clienteIdBody = body?.clienteId ? String(body.clienteId) : null;
  if (pagoCredito && !clienteIdBody) {
    return badRequest("Selecciona al cliente para poder registrar la venta a crédito");
  }

  await connectDB();

  // La matriz vende de mostrador con su propia caja y descontando la existencia
  // del CEDIS; una sucursal descuenta su inventario.
  const ctx = await contextoPuntoVenta(session);
  if (!ctx) return forbidden();

  const sesionCaja = await CajaSesion.findOne({ sucursalId: ctx.sucursalId, estado: "abierta" });
  if (!sesionCaja) return badRequest("Debes abrir la caja antes de registrar ventas");

  // El cliente es opcional en una venta de contado, pero obligatorio (y validado
  // contra su límite y sus vencidos) cuando parte del pago va a crédito.
  const zonaHoraria = await zonaHorariaDeSucursal(ctx.sucursalId);

  const cliente = clienteIdBody ? await Cliente.findById(clienteIdBody) : null;
  if (clienteIdBody) {
    if (!cliente || String(cliente.sucursalId) !== String(ctx.sucursalId)) {
      return badRequest("El cliente no existe en esta sucursal");
    }
  }

  let vencimientoCredito: Date | null = null;
  if (pagoCredito && cliente) {
    const cuentasAbiertas = await CuentaPorCobrar.find({ clienteId: cliente._id, estado: "pendiente" }).lean();
    const resumen = resumenCredito(cliente, cuentasAbiertas as unknown as CuentaLike[], zonaHoraria);
    const motivo = motivoRechazoCredito(cliente, resumen, pagoCredito.monto);
    if (motivo) return conflict(motivo);
  }

  const productoIds = items.map((i) => i.productoId);
  const productos = await Producto.find({ _id: { $in: productoIds }, activo: true });
  const productoMap = new Map(productos.map((p) => [String(p._id), p]));

  const stockPorProducto = await stockPuntoVenta(ctx, productoIds);

  const ventaItems = [];
  const sinStock: string[] = [];
  let total = 0;

  for (const item of items) {
    const producto = productoMap.get(item.productoId);
    const cantidad = Number(item.cantidad);
    if (!producto || !cantidad || cantidad <= 0) {
      return badRequest("Producto inválido o cantidad inválida en la venta");
    }

    const stockActual = stockPorProducto.get(item.productoId) ?? 0;
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
  if (pagoCredito && cliente) {
    vencimientoCredito = calcularVencimiento(fechaVenta, cliente.credito?.diasCredito ?? 30);
  }

  const ventas2 = await resolverVentas2ParaVenta({
    sucursalId: ctx.sucursalId,
    pagos,
    fecha: fechaVenta,
  });

  const venta = await Venta.create({
    folio: await siguienteFolio(ventas2.esVentas2 ? "V2" : "VTA"),
    sucursalId: ctx.sucursalId,
    cajaSesionId: sesionCaja._id,
    usuarioId: session.userId,
    fecha: fechaVenta,
    corte: todayCorte(zonaHoraria),
    items: ventaItems,
    total,
    pagos,
    montoRecibido: pagoEfectivo ? montoRecibido : null,
    cambio: pagoEfectivo && montoRecibido != null ? Number((montoRecibido - pagoEfectivo.monto).toFixed(2)) : null,
    esVentas2: ventas2.esVentas2,
    ventas2ActivacionId: ventas2.activacionId,
    ventas2SecuenciaEfectivo: ventas2.secuenciaEfectivo,
    clienteId: cliente?._id ?? null,
    clienteNombre: cliente?.nombre ?? "",
    creditoMonto: pagoCredito?.monto ?? null,
    creditoFechaVencimiento: vencimientoCredito,
  });

  if (pagoCredito && cliente && vencimientoCredito) {
    await CuentaPorCobrar.create({
      clienteId: cliente._id,
      sucursalId: ctx.sucursalId,
      ventaId: venta._id,
      folio: venta.folio,
      fecha: fechaVenta,
      fechaVencimiento: vencimientoCredito,
      diasCredito: cliente.credito?.diasCredito ?? 30,
      monto: pagoCredito.monto,
      saldo: pagoCredito.monto,
    });
    await recalcularSaldoCliente(cliente._id);
  }

  for (const item of ventaItems) {
    await ajustarStockPuntoVenta(ctx, item.productoId, -item.cantidad);
    await MovimientoInventario.create({
      tipo: "salida_venta",
      productoId: item.productoId,
      nombreProducto: item.nombreProducto,
      ubicacion: ubicacionDeMovimiento(ctx),
      cantidad: item.cantidad,
      ventaId: venta._id,
      usuarioId: session.userId,
    });
  }

  return NextResponse.json(venta, { status: 201 });
}
