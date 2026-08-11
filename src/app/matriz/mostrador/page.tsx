import { connectDB } from "@/lib/db";
import { obtenerMostradorMatriz } from "@/lib/puntoVenta";
import { PuntoVentaForm } from "@/components/sucursal/PuntoVentaForm";

export const dynamic = "force-dynamic";

/** Punto de venta de matriz: cobra al público que llega al CEDIS. */
export default async function MostradorMatrizPage() {
  await connectDB();
  const mostrador = await obtenerMostradorMatriz();

  return <PuntoVentaForm sucursalNombre={mostrador?.nombre ?? "Matriz"} />;
}
