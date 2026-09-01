import { formatFechaLarga, formatHora, ZONA_HORARIA_DEFAULT } from "@/lib/zonasHorarias";

// Abre una ventana nueva con contenido HTML listo para imprimir y dispara el
// diálogo de impresión del navegador. Se usa para pedidos y órdenes de
// compra, generando el HTML a partir de los datos que ya están cargados en
// pantalla (no requiere otra llamada al servidor).
//
// `zona` es la zona horaria de la sucursal (useZonaHoraria()); sin ella el sello
// de generación saldría con la hora del sistema operativo de la PC.
export function imprimirHTML(titulo: string, contenidoHTML: string, zona: string = ZONA_HORARIA_DEFAULT) {
  const ventana = window.open("", "_blank", "width=850,height=900");
  if (!ventana) return;

  const ahora = new Date();
  const fecha = formatFechaLarga(ahora, zona);
  const hora = formatHora(ahora, zona);

  ventana.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${titulo}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; color: #262626; margin: 0; }
          .encabezado {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #0f4a20;
            color: #fff;
            padding: 16px 24px;
          }
          .encabezado .marca { display: flex; align-items: center; gap: 12px; }
          .encabezado img { height: 38px; display: block; }
          .encabezado .marca-texto { line-height: 1.3; }
          .encabezado .marca-texto strong { display: block; font-size: 14px; }
          .encabezado .marca-texto span { font-size: 10px; color: #cfe8d3; }
          .encabezado .generado { font-size: 11px; color: #cfe8d3; text-align: right; line-height: 1.4; }
          .contenido { padding: 24px; }
          h1 { font-size: 19px; margin: 0 0 4px; color: #0f4a20; }
          .subtitulo { color: #666; font-size: 13px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
          th, td { text-align: left; padding: 8px; }
          thead tr { background: #e3f3e6; }
          th { color: #0f4a20; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.02em; }
          tbody tr { border-bottom: 1px solid #eee; }
          tbody tr:nth-child(even) { background: #fafafa; }
          tfoot td { border-top: 2px solid #0f4a20; border-bottom: none; font-weight: 700; padding-top: 12px; color: #0f4a20; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
          .pie {
            margin-top: 32px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #999;
          }
          @media print {
            .encabezado, thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="encabezado">
          <div class="marca">
            <img src="/media/logo.png" alt="Mercados Titos" />
            <div class="marca-texto">
              <strong>Mercados Titos</strong>
              <span>Sistema de abasto</span>
            </div>
          </div>
          <div class="generado">Generado el ${fecha}<br />${hora}</div>
        </div>
        <div class="contenido">
          ${contenidoHTML}
          <div class="pie">
            <span>Titos · documento generado automáticamente</span>
            <span>${fecha} · ${hora}</span>
          </div>
        </div>
      </body>
    </html>
  `);

  ventana.document.close();
  ventana.focus();
  ventana.print();
}

/** Escapa texto que viene de la base (nombres de producto, cajero, sucursal). */
export function escaparHTML(texto: string) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Imprime un ticket en rollo de 80 mm (la impresora térmica del mostrador).
 *
 * A diferencia de `imprimirHTML`, que arma un documento tamaño carta con el
 * encabezado verde de la marca, aquí todo va a una sola columna angosta, en
 * monoespaciada y sin fondos de color: la térmica no imprime color y cualquier
 * margen de más recorta el renglón.
 */
export function imprimirTicket(titulo: string, contenidoHTML: string) {
  const ventana = window.open("", "_blank", "width=380,height=700");
  if (!ventana) return;

  ventana.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escaparHTML(titulo)}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; }
          body {
            width: 80mm;
            margin: 0;
            padding: 4mm 3mm;
            font-family: "Courier New", Courier, monospace;
            font-size: 11px;
            line-height: 1.35;
            color: #000;
            background: #fff;
          }
          .centro { text-align: center; }
          .titulo { font-size: 14px; font-weight: bold; letter-spacing: 0.04em; }
          .sucursal { font-size: 12px; font-weight: bold; }
          .sep { border-top: 1px dashed #000; margin: 5px 0; }
          .fila { display: flex; justify-content: space-between; gap: 6px; }
          .fila span:last-child { white-space: nowrap; }
          .concepto { flex: 1; word-break: break-word; }
          .fuerte { font-weight: bold; font-size: 13px; }
          .tenue { font-size: 10px; }
          .pie { margin-top: 8px; font-size: 10px; }
        </style>
      </head>
      <body>${contenidoHTML}</body>
    </html>
  `);

  ventana.document.close();
  ventana.focus();
  ventana.print();
}
