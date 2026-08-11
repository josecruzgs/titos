import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ActualizacionPrecio from "@/models/ActualizacionPrecio";
import { requireSession, unauthorized, forbidden, badRequest, notFound } from "@/lib/apiAuth";
import { generarTablaPDF, formatMoney } from "@/lib/pdf";
import { formatFechaLarga, formatHora, ZONA_HORARIA_DEFAULT } from "@/lib/zonasHorarias";

function rangoPeriodo(url: URL) {
  const ahora = new Date();
  const desdeParam = url.searchParams.get("desde");
  const hastaParam = url.searchParams.get("hasta");
  // Por default: la última hora
  const desde = desdeParam ? new Date(desdeParam) : new Date(ahora.getTime() - 60 * 60 * 1000);
  const hasta = hastaParam ? new Date(hastaParam) : ahora;
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return null;
  return { desde, hasta };
}

function formatFechaHora(fecha: Date) {
  const f = formatFechaLarga(fecha, ZONA_HORARIA_DEFAULT);
  const h = formatHora(fecha, ZONA_HORARIA_DEFAULT);
  return `${f} ${h}`;
}

function truncar(texto: string, max: number) {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const rango = rangoPeriodo(new URL(req.url));
  if (!rango) return badRequest("Periodo inválido");

  await connectDB();
  const cambios = await ActualizacionPrecio.find({ createdAt: { $gte: rango.desde, $lte: rango.hasta } })
    .populate("productoId", "categoria unidad")
    .sort({ nombre: 1, createdAt: 1 })
    .lean();

  if (cambios.length === 0) {
    return notFound("No hay precios actualizados en el periodo seleccionado");
  }

  const filas = cambios.map((c) => {
    const producto = (c.productoId ?? {}) as { categoria?: string; unidad?: string };
    return [
      truncar(c.sku, 14),
      truncar(c.nombre, 38),
      truncar((producto.categoria ?? "").replaceAll("_", " "), 16),
      producto.unidad ?? "",
      formatMoney(c.precioAnterior),
      formatMoney(c.precioNuevo),
      formatFechaHora(new Date(c.createdAt as unknown as string)),
    ];
  });

  const pdfBytes = await generarTablaPDF({
    titulo: "Precios actualizados",
    subtitulo: [
      `Periodo: ${formatFechaHora(rango.desde)} — ${formatFechaHora(rango.hasta)}`,
      "Aviso para sucursales: los siguientes productos cambiaron de precio de venta.",
    ],
    tabla: {
      columnas: [
        { header: "Código", width: 62 },
        { header: "Producto", width: 168 },
        { header: "Categoría", width: 70 },
        { header: "Unidad", width: 40 },
        { header: "P. anterior", width: 58, align: "right" },
        { header: "P. nuevo", width: 58, align: "right" },
        { header: "Fecha", width: 78, align: "right" },
      ],
      filas,
    },
    totalLabel: "Productos actualizados:",
    totalValor: String(cambios.length),
  });

  const nombreArchivo = `precios-actualizados-${rango.hasta.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
