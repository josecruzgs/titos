import { escaparHTML, imprimirTicket } from "@/lib/print";
import { formatFechaLarga, formatHora } from "@/lib/zonasHorarias";

// Ticket de venta para la impresora térmica del mostrador. Vive aparte del
// punto de venta para que el historial de ventas pueda reimprimir exactamente
// el mismo documento sin duplicar el armado.

const ETIQUETA_METODO: Record<string, string> = {
  efectivo: "Efectivo",
  efectivo_usd: "Efectivo USD",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  vales: "Vales despensa",
  credito: "Crédito",
};

export type PagoTicket = {
  metodoPago: string;
  monto: number;
  montoUsd?: number | null;
  tipoCambio?: number | null;
  terminalAlias?: string;
};

export type ItemTicket = {
  nombreProducto: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  subtotal: number;
};

export type VentaTicket = {
  folio: string;
  fecha?: string | Date | null;
  items: ItemTicket[];
  total: number;
  pagos: PagoTicket[];
  montoRecibido?: number | null;
  cambio?: number | null;
  /**
   * Ventas que cayeron en el protocolo de Notas de venta (/matriz/notas-de-venta).
   * Es lo único que marca el asterisco del encabezado.
   */
  esVentas2?: boolean;
  clienteNombre?: string;
  creditoMonto?: number | null;
};

function pesos(valor: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(valor);
}

function fila(concepto: string, importe: string, clase = "") {
  return `<div class="fila ${clase}"><span class="concepto">${concepto}</span><span>${importe}</span></div>`;
}

/** Cantidad legible: los kilos llevan decimales, las piezas no. */
function cantidadTexto(item: ItemTicket) {
  const cantidad = item.unidad === "kg" ? item.cantidad.toFixed(3) : String(item.cantidad);
  return `${cantidad} ${item.unidad}`;
}

/**
 * Encabezado del ticket. El asterisco junto al nombre de la sucursal distingue
 * las ventas que entraron por el protocolo de Notas de venta: es la marca que
 * pidió matriz para separarlas de un vistazo sin cambiar nada más del formato.
 */
function encabezado(venta: VentaTicket, sucursalNombre: string) {
  const nombre = `${sucursalNombre || "Sucursal"}${venta.esVentas2 ? " *" : ""}`;
  return `
    <div class="centro">
      <div class="titulo">MERCADOS TITOS</div>
      <div class="sucursal">${escaparHTML(nombre)}</div>
    </div>
  `;
}

function detallePago(pago: PagoTicket) {
  const etiqueta = ETIQUETA_METODO[pago.metodoPago] ?? pago.metodoPago;
  const lineas = [fila(escaparHTML(etiqueta), pesos(pago.monto))];

  if (pago.metodoPago === "efectivo_usd" && pago.montoUsd) {
    const tipoCambio = pago.tipoCambio ?? 0;
    lineas.push(
      fila(
        `<span class="tenue">Recibido ${pago.montoUsd.toFixed(2)} USD${
          tipoCambio ? ` a ${pesos(tipoCambio)}` : ""
        }</span>`,
        ""
      )
    );
    // El cambio de un pago en dólares se devuelve en pesos.
    const sobrante = Number((pago.montoUsd * tipoCambio - pago.monto).toFixed(2));
    if (sobrante > 0) lineas.push(fila('<span class="tenue">Cambio en pesos</span>', pesos(sobrante)));
  }

  if (pago.metodoPago === "tarjeta" && pago.terminalAlias) {
    lineas.push(fila(`<span class="tenue">Terminal ${escaparHTML(pago.terminalAlias)}</span>`, ""));
  }

  return lineas.join("");
}

export function ticketVentaHTML(
  venta: VentaTicket,
  {
    sucursalNombre = "",
    zonaHoraria,
    cajero = "",
  }: { sucursalNombre?: string; zonaHoraria: string; cajero?: string }
) {
  const fecha = venta.fecha ? new Date(venta.fecha) : new Date();
  const hayEfectivo = venta.pagos.some((p) => p.metodoPago === "efectivo");

  const datos = [
    fila("Folio", escaparHTML(venta.folio)),
    fila("Fecha", `${formatFechaLarga(fecha, zonaHoraria)} ${formatHora(fecha, zonaHoraria)}`),
    cajero ? fila("Atendió", escaparHTML(cajero)) : "",
    venta.clienteNombre ? fila("Cliente", escaparHTML(venta.clienteNombre)) : "",
  ].join("");

  const items = venta.items
    .map((i) =>
      [
        `<div>${escaparHTML(i.nombreProducto)}</div>`,
        fila(
          `<span class="tenue">${cantidadTexto(i)} x ${pesos(i.precioUnitario)}</span>`,
          pesos(i.subtotal)
        ),
      ].join("")
    )
    .join("");

  const efectivo = hayEfectivo
    ? [
        fila("Recibido", pesos(venta.montoRecibido ?? 0)),
        fila("Cambio", pesos(venta.cambio ?? 0)),
      ].join("")
    : "";

  const credito = venta.creditoMonto
    ? `<div class="sep"></div><div class="centro">Venta a crédito por ${pesos(venta.creditoMonto)}</div>`
    : "";

  return `
    ${encabezado(venta, sucursalNombre)}
    <div class="sep"></div>
    ${datos}
    <div class="sep"></div>
    ${items}
    <div class="sep"></div>
    ${fila("TOTAL", pesos(venta.total), "fuerte")}
    <div class="sep"></div>
    ${venta.pagos.map(detallePago).join("")}
    ${efectivo}
    ${credito}
    <div class="sep"></div>
    <div class="centro pie">
      ¡Gracias por su compra!<br />
      Presenta este ticket para cualquier aclaración.
    </div>
  `;
}

export function imprimirTicketVenta(
  venta: VentaTicket,
  opciones: { sucursalNombre?: string; zonaHoraria: string; cajero?: string }
) {
  imprimirTicket(`Ticket ${venta.folio}`, ticketVentaHTML(venta, opciones));
}
