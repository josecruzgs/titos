import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const PAGE_WIDTH = 595.28; // A4 portrait, en puntos
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const VERDE_TITOS: [number, number, number] = [0.11, 0.35, 0.18];
const GRIS: [number, number, number] = [0.4, 0.4, 0.4];

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

type Columna = { header: string; width: number; align?: "left" | "right" };
type Tabla = { titulo?: string; columnas: Columna[]; filas: string[][] };

type TablaPDFOpciones = {
  titulo: string;
  subtitulo: string[];
  tabla: Tabla;
  totalLabel: string;
  totalValor: string;
  tablaExtra?: Tabla;
};

export { formatMoney };

export async function generarTablaPDF(opciones: TablaPDFOpciones): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function nuevaPagina() {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  function escribir(
    texto: string,
    opts: { size?: number; font?: PDFFont; x?: number; color?: [number, number, number] } = {}
  ) {
    const { size = 10, font = fontRegular, x = MARGIN, color = [0, 0, 0] } = opts;
    page.drawText(texto, { x, y, size, font, color: rgb(...color) });
  }

  function linea(color: [number, number, number] = [0.85, 0.85, 0.85], grosor = 0.6) {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: grosor,
      color: rgb(...color),
    });
  }

  function dibujarTabla(tabla: Tabla) {
    if (tabla.titulo) {
      escribir(tabla.titulo, { size: 12, font: fontBold, color: VERDE_TITOS });
      y -= 18;
    }

    let x = MARGIN;
    for (const col of tabla.columnas) {
      escribir(col.header, { size: 9, font: fontBold, x, color: GRIS });
      x += col.width;
    }
    y -= 6;
    linea();
    y -= 14;

    for (const fila of tabla.filas) {
      if (y < MARGIN + 30) nuevaPagina();
      x = MARGIN;
      fila.forEach((celda, i) => {
        const col = tabla.columnas[i];
        const ancho = fontRegular.widthOfTextAtSize(celda, 9);
        const textoX = col.align === "right" ? x + col.width - ancho : x;
        escribir(celda, { size: 9, x: textoX });
        x += col.width;
      });
      y -= 15;
    }
    y -= 8;
  }

  escribir(opciones.titulo, { size: 16, font: fontBold, color: VERDE_TITOS });
  y -= 20;
  for (const l of opciones.subtitulo) {
    escribir(l, { size: 10, color: GRIS });
    y -= 13;
  }
  y -= 10;

  dibujarTabla(opciones.tabla);

  linea([0.6, 0.6, 0.6], 0.8);
  y -= 16;
  const anchoTotalLabel = fontBold.widthOfTextAtSize(opciones.totalLabel, 11);
  escribir(opciones.totalLabel, { size: 11, font: fontBold, x: PAGE_WIDTH - MARGIN - 100 - anchoTotalLabel, color: VERDE_TITOS });
  escribir(opciones.totalValor, { size: 11, font: fontBold, x: PAGE_WIDTH - MARGIN - 90, color: VERDE_TITOS });
  y -= 26;

  if (opciones.tablaExtra && opciones.tablaExtra.filas.length > 0) {
    dibujarTabla(opciones.tablaExtra);
  }

  return pdf.save();
}

type PedidoItemPDF = {
  nombreProducto: string;
  unidad: string;
  requierePesaje: boolean;
  precioVenta: number;
  cantidadPedida: number;
  cantidadAsignada: number | null;
  cantidadSurtida: number | null;
  pesoSurtidoKg: number | null;
};

type CajaPDF = {
  numero: string;
  cincho1: string;
  cincho2: string;
  categoria: string;
  items: { nombreProducto: string; cantidad: number }[];
};

export async function generarPdfPedido(pedido: {
  folio: string;
  corte: string;
  estado: string;
  sucursalNombre: string;
  repartidorNombre?: string | null;
  items: PedidoItemPDF[];
  cajas: CajaPDF[];
}): Promise<Uint8Array> {
  const montoLinea = (i: PedidoItemPDF) => (i.cantidadSurtida ?? i.cantidadAsignada ?? i.cantidadPedida) * i.precioVenta;
  const total = pedido.items.reduce((s, i) => s + montoLinea(i), 0);

  const filas = pedido.items.map((i) => [
    i.nombreProducto + (i.requierePesaje ? " (pesaje)" : ""),
    `${i.cantidadPedida} ${i.unidad}`,
    i.cantidadAsignada != null ? String(i.cantidadAsignada) : "—",
    i.cantidadSurtida != null ? `${i.cantidadSurtida}${i.pesoSurtidoKg ? ` (${i.pesoSurtidoKg}kg)` : ""}` : "—",
    formatMoney(i.precioVenta),
    formatMoney(montoLinea(i)),
  ]);

  const filasCajas = pedido.cajas.map((c) => [
    `Caja ${c.numero}`,
    c.categoria,
    c.items.map((i) => `${i.nombreProducto} (${i.cantidad})`).join(", "),
    `${c.cincho1} / ${c.cincho2}`,
  ]);

  return generarTablaPDF({
    titulo: `Pedido ${pedido.folio}`,
    subtitulo: [
      `Sucursal: ${pedido.sucursalNombre}`,
      `Corte: ${pedido.corte}  ·  Estado: ${pedido.estado}`,
      ...(pedido.repartidorNombre ? [`Repartidor: ${pedido.repartidorNombre}`] : []),
    ],
    tabla: {
      columnas: [
        { header: "Producto", width: 175 },
        { header: "Pedido", width: 65 },
        { header: "Nivelado", width: 60 },
        { header: "Surtido", width: 80 },
        { header: "P. venta", width: 65, align: "right" },
        { header: "Subtotal", width: 70, align: "right" },
      ],
      filas,
    },
    totalLabel: "Total:",
    totalValor: formatMoney(total),
    tablaExtra:
      filasCajas.length > 0
        ? {
            titulo: "Cajas selladas",
            columnas: [
              { header: "Caja", width: 60 },
              { header: "Categoría", width: 90 },
              { header: "Contenido", width: 255 },
              { header: "Cinchos", width: 105 },
            ],
            filas: filasCajas,
          }
        : undefined,
  });
}

type OrdenItemPDF = {
  nombreProducto: string;
  cantidadOrdenada: number;
  cantidadRecibida: number | null;
  precioUnitario: number;
};

export async function generarPdfOrdenCompra(orden: {
  folio: string;
  estado: string;
  proveedorNombre: string;
  fecha: string;
  items: OrdenItemPDF[];
}): Promise<Uint8Array> {
  const montoLinea = (i: OrdenItemPDF) => (i.cantidadRecibida ?? i.cantidadOrdenada) * i.precioUnitario;
  const total = orden.items.reduce((s, i) => s + montoLinea(i), 0);

  const filas = orden.items.map((i) => [
    i.nombreProducto,
    String(i.cantidadOrdenada),
    i.cantidadRecibida != null ? String(i.cantidadRecibida) : "—",
    formatMoney(i.precioUnitario),
    formatMoney(montoLinea(i)),
  ]);

  return generarTablaPDF({
    titulo: `Orden de compra ${orden.folio}`,
    subtitulo: [`Proveedor: ${orden.proveedorNombre}`, `Fecha: ${orden.fecha}  ·  Estado: ${orden.estado}`],
    tabla: {
      columnas: [
        { header: "Producto", width: 195 },
        { header: "Ordenado", width: 80 },
        { header: "Recibido", width: 80 },
        { header: "P. unitario", width: 80, align: "right" },
        { header: "Subtotal", width: 80, align: "right" },
      ],
      filas,
    },
    totalLabel: "Total:",
    totalValor: formatMoney(total),
  });
}
