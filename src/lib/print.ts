// Abre una ventana nueva con contenido HTML listo para imprimir y dispara el
// diálogo de impresión del navegador. Se usa para pedidos y órdenes de
// compra, generando el HTML a partir de los datos que ya están cargados en
// pantalla (no requiere otra llamada al servidor).
export function imprimirHTML(titulo: string, contenidoHTML: string) {
  const ventana = window.open("", "_blank", "width=850,height=900");
  if (!ventana) return;

  const ahora = new Date();
  const fecha = ahora.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  const hora = ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

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
