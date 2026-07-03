import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Pedido from "@/models/Pedido";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";

const PERIODOS = ["diario", "semanal", "mensual"] as const;
type Periodo = (typeof PERIODOS)[number];

const CANTIDAD_BUCKETS: Record<Periodo, number> = { diario: 14, semanal: 12, mensual: 12 };

type Bucket = { inicio: Date; fin: Date; label: string };

function generarBuckets(periodo: Periodo, cantidad: number, hoy: Date): Bucket[] {
  const buckets: Bucket[] = [];

  if (periodo === "mensual") {
    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    for (let i = cantidad - 1; i >= 0; i--) {
      const inicio = new Date(inicioMesActual.getFullYear(), inicioMesActual.getMonth() - i, 1);
      const fin = new Date(inicioMesActual.getFullYear(), inicioMesActual.getMonth() - i + 1, 1);
      buckets.push({ inicio, fin, label: inicio.toLocaleDateString("es-MX", { month: "short", year: "2-digit" }) });
    }
    return buckets;
  }

  const diasPorBucket = periodo === "semanal" ? 7 : 1;
  const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  for (let i = cantidad - 1; i >= 0; i--) {
    const fin = new Date(finHoy.getTime() - i * diasPorBucket * 86400000);
    const inicio = new Date(fin.getTime() - diasPorBucket * 86400000);
    buckets.push({ inicio, fin, label: inicio.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) });
  }
  return buckets;
}

function calcularTendencia(valores: number[]) {
  const n = valores.length;
  if (n < 2) return { direccion: "estable" as const, cambioPct: 0, valoresAjustados: valores.slice() };

  const xs = valores.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = valores.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * valores[i], 0);
  const sumXX = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  const pendiente = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercepto = (sumY - pendiente * sumX) / n;

  const valoresAjustados = xs.map((x) => Math.max(0, intercepto + pendiente * x));
  const inicioFit = valoresAjustados[0];
  const finFit = valoresAjustados[n - 1];
  const base = inicioFit > 0.01 ? inicioFit : sumY / n || 1;
  const cambioPct = ((finFit - inicioFit) / base) * 100;
  const direccion = cambioPct > 3 ? "alza" : cambioPct < -3 ? "baja" : "estable";

  return { direccion, cambioPct, valoresAjustados };
}

// Usa la cantidad más avanzada que se conozca del ciclo de vida del pedido
// (surtida > asignada por el Nivelador > pedida), igual que en el módulo de
// Pedidos, para que la venta reportada coincida con lo realmente facturado.
function montoLineaItem(item: { cantidadSurtida?: number | null; cantidadAsignada?: number | null; cantidadPedida: number; precioVenta?: number }) {
  const cantidad = item.cantidadSurtida ?? item.cantidadAsignada ?? item.cantidadPedida;
  return cantidad * (item.precioVenta ?? 0);
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const url = new URL(req.url);
  const periodoParam = url.searchParams.get("periodo") ?? "diario";
  if (!PERIODOS.includes(periodoParam as Periodo)) return badRequest("Periodo inválido");
  const periodo = periodoParam as Periodo;

  await connectDB();

  const cantidad = CANTIDAD_BUCKETS[periodo];
  const buckets = generarBuckets(periodo, cantidad * 2, new Date());
  const totales = new Array(buckets.length).fill(0);

  // Sólo cuentan como venta los pedidos que ya salieron del almacén: aún no
  // se factura lo que sigue en "nivelado" esperando a ser surtido.
  const pedidos = await Pedido.find({ estado: { $in: ["surtido", "recibido"] } })
    .select("corte items")
    .lean();

  for (const pedido of pedidos) {
    const fecha = new Date(`${pedido.corte}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) continue;

    type PedidoItemLean = (typeof pedido.items)[number];
    const total = pedido.items.reduce((sum: number, item: PedidoItemLean) => sum + montoLineaItem(item), 0);

    for (let i = 0; i < buckets.length; i++) {
      if (fecha >= buckets[i].inicio && fecha < buckets[i].fin) {
        totales[i] += total;
        break;
      }
    }
  }

  const anteriorBuckets = buckets.slice(0, cantidad);
  const actualBuckets = buckets.slice(cantidad);
  const totalesAnterior = totales.slice(0, cantidad);
  const totalesActual = totales.slice(cantidad);

  const totalActual = totalesActual.reduce((a, b) => a + b, 0);
  const totalAnterior = totalesAnterior.reduce((a, b) => a + b, 0);
  const variacionPct = totalAnterior > 0 ? ((totalActual - totalAnterior) / totalAnterior) * 100 : null;

  const tendencia = calcularTendencia(totalesActual);

  return NextResponse.json({
    periodo,
    actual: actualBuckets.map((b, i) => ({ label: b.label, total: Math.round(totalesActual[i] * 100) / 100 })),
    anterior: anteriorBuckets.map((b, i) => ({ label: b.label, total: Math.round(totalesAnterior[i] * 100) / 100 })),
    totalActual: Math.round(totalActual * 100) / 100,
    totalAnterior: Math.round(totalAnterior * 100) / 100,
    variacionPct: variacionPct !== null ? Math.round(variacionPct * 10) / 10 : null,
    tendencia: {
      direccion: tendencia.direccion,
      cambioPct: Math.round(tendencia.cambioPct * 10) / 10,
      valores: tendencia.valoresAjustados.map((v) => Math.round(v * 100) / 100),
    },
  });
}
