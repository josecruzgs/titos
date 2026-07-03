// Abre una ventana nueva con contenido HTML listo para imprimir y dispara el
// diálogo de impresión del navegador. Se usa para pedidos y órdenes de
// compra, generando el HTML a partir de los datos que ya están cargados en
// pantalla (no requiere otra llamada al servidor).
export function imprimirHTML(titulo: string, contenidoHTML: string) {
  const ventana = window.open("", "_blank", "width=850,height=900");
  if (!ventana) return;

  ventana.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${titulo}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; color: #1c1c1c; padding: 24px; }
          h1 { font-size: 20px; margin: 0 0 4px; color: #146b2e; }
          .subtitulo { color: #666; font-size: 13px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
          th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; }
          th { color: #666; font-weight: 600; }
          tfoot td { border-top: 2px solid #333; border-bottom: none; font-weight: 700; padding-top: 10px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${contenidoHTML}
      </body>
    </html>
  `);

  ventana.document.close();
  ventana.focus();
  ventana.print();
}
