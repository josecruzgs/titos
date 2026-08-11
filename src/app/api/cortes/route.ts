import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CajaSesion from "@/models/CajaSesion";
import MovimientoCaja from "@/models/MovimientoCaja";
import "@/models/Sucursal"; // necesario para que populate("sucursalId") funcione
import "@/models/User"; // necesario para populate de los usuarios de apertura/cierre
import { requireSession, unauthorized, forbidden } from "@/lib/apiAuth";

/**
 * Corte global: todos los cierres de caja de las sucursales en un rango, con
 * sus retiros. Matriz ve todas; una sucursal solo la suya.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const filtro: Record<string, unknown> = { estado: "cerrada" };

  if (session.role === "matriz") {
    const sucursalId = url.searchParams.get("sucursalId");
    if (sucursalId) filtro.sucursalId = sucursalId;
  } else if (session.sucursalId) {
    filtro.sucursalId = session.sucursalId;
  } else {
    return forbidden();
  }

  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");
  if (desde || hasta) {
    const rango: Record<string, Date> = {};
    if (desde) rango.$gte = new Date(`${desde}T00:00:00`);
    // El fin del rango es inclusivo: se toma todo el día indicado.
    if (hasta) rango.$lte = new Date(`${hasta}T23:59:59.999`);
    filtro.fechaCierre = rango;
  }

  await connectDB();

  const sesiones = await CajaSesion.find(filtro)
    .sort({ fechaCierre: -1 })
    .limit(300)
    .populate("sucursalId", "nombre")
    .populate("usuarioAperturaId", "nombre")
    .populate("usuarioCierreId", "nombre")
    .lean();

  const retiros = await MovimientoCaja.find({ cajaSesionId: { $in: sesiones.map((s) => s._id) } })
    .sort({ fecha: 1 })
    .lean();

  const retirosPorSesion = new Map<string, typeof retiros>();
  for (const retiro of retiros) {
    const key = String(retiro.cajaSesionId);
    const lista = retirosPorSesion.get(key) ?? [];
    lista.push(retiro);
    retirosPorSesion.set(key, lista);
  }

  return NextResponse.json(
    sesiones.map((sesion) => ({
      ...sesion,
      retiros: retirosPorSesion.get(String(sesion._id)) ?? [],
    }))
  );
}
