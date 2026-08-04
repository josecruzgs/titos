import { getSession } from "@/lib/getSession";
import { connectDB } from "@/lib/db";
import Sucursal from "@/models/Sucursal";
import { PuntoVentaForm } from "@/components/sucursal/PuntoVentaForm";

export const dynamic = "force-dynamic";

export default async function SucursalPuntoVenta() {
  const session = await getSession();
  await connectDB();
  const sucursal = session?.sucursalId
    ? await Sucursal.findById(session.sucursalId).select("nombre").lean()
    : null;
  const sucursalNombre = (sucursal as { nombre?: string } | null)?.nombre ?? "";

  return <PuntoVentaForm sucursalNombre={sucursalNombre} />;
}
