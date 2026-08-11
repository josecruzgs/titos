import InventarioSucursal from "@/models/InventarioSucursal";
import MovimientoInventario from "@/models/MovimientoInventario";

type MovimientoPrestamo =
  | "salida_prestamo"
  | "entrada_prestamo"
  | "salida_devolucion_prestamo"
  | "entrada_devolucion_prestamo";

/** Mueve stock de una sucursal y deja el movimiento registrado. `delta` negativo descuenta. */
export async function moverStockPrestamo({
  sucursalId,
  productoId,
  nombreProducto,
  delta,
  tipo,
  prestamoId,
  usuarioId,
}: {
  sucursalId: unknown;
  productoId: unknown;
  nombreProducto: string;
  delta: number;
  tipo: MovimientoPrestamo;
  prestamoId: unknown;
  usuarioId: unknown;
}) {
  await InventarioSucursal.findOneAndUpdate(
    { sucursalId, productoId },
    { $inc: { stockActual: delta } },
    { upsert: true }
  );
  await MovimientoInventario.create({
    tipo,
    productoId,
    nombreProducto,
    ubicacion: String(sucursalId),
    cantidad: Math.abs(delta),
    prestamoId,
    usuarioId,
  });
}

export type ItemPrestamoLike = {
  cantidadEntregada: number;
  cantidadDevuelta: number;
};

/** Un préstamo está saldado cuando ya se devolvió todo lo que se entregó. */
export function estaSaldado(items: ItemPrestamoLike[]) {
  return items.every((i) => i.cantidadDevuelta >= i.cantidadEntregada - 0.0005);
}

export function pendientePorDevolver(items: ItemPrestamoLike[]) {
  return items.reduce((sum, i) => sum + Math.max(0, i.cantidadEntregada - i.cantidadDevuelta), 0);
}
