import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSession, unauthorized, forbidden } from "@/lib/apiAuth";
import { consultarHistorialVentas, filtroDesdeUrl } from "@/lib/historialVentas";

/** Historial monetario de ventas de todas las sucursales, para matriz. */
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  await connectDB();
  const { filas, resumen } = await consultarHistorialVentas(filtroDesdeUrl(new URL(req.url)));

  return NextResponse.json({ ventas: filas, resumen });
}
