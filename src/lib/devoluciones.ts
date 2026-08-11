import Devolucion, { HORAS_LIMITE_DEVOLUCION } from "@/models/Devolucion";

const MS_POR_HORA = 60 * 60 * 1000;

export function horasDesde(fecha: Date, ahora: Date) {
  return (ahora.getTime() - fecha.getTime()) / MS_POR_HORA;
}

/** La ventana de devolución corre desde la hora exacta de la venta. */
export function dentroDeVentana(fechaVenta: Date, ahora: Date) {
  return horasDesde(fechaVenta, ahora) <= HORAS_LIMITE_DEVOLUCION;
}

export function horasRestantes(fechaVenta: Date, ahora: Date) {
  return Math.max(0, HORAS_LIMITE_DEVOLUCION - horasDesde(fechaVenta, ahora));
}

export type ItemVentaLike = {
  productoId: unknown;
  sku: string;
  nombreProducto: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
};

/**
 * Cuánto queda por devolver de cada línea de una venta, descontando lo que ya
 * se devolvió antes (una venta se puede devolver en varias partes).
 */
export async function calcularDevolvible(ventaId: unknown, items: ItemVentaLike[]) {
  const previas = await Devolucion.find({ ventaId, estado: { $ne: "cancelada" } }).select("items").lean();

  const yaDevuelto = new Map<string, number>();
  for (const devolucion of previas) {
    for (const item of devolucion.items) {
      const key = String(item.productoId);
      yaDevuelto.set(key, (yaDevuelto.get(key) ?? 0) + item.cantidad);
    }
  }

  return items.map((item) => {
    const key = String(item.productoId);
    const devuelto = yaDevuelto.get(key) ?? 0;
    return {
      productoId: key,
      sku: item.sku,
      nombreProducto: item.nombreProducto,
      unidad: item.unidad,
      precioUnitario: item.precioUnitario,
      cantidadVendida: item.cantidad,
      cantidadDevuelta: devuelto,
      // El redondeo evita que un 0.0000001 de punto flotante deje una línea
      // "devolvible" cuando ya se devolvió completa.
      cantidadDisponible: Math.max(0, Number((item.cantidad - devuelto).toFixed(3))),
    };
  });
}

export { HORAS_LIMITE_DEVOLUCION };
