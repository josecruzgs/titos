import { getSession } from "@/lib/getSession";
import { connectDB } from "@/lib/db";
import Venta from "@/models/Venta";
import { PageHeader, Card, formatMoney, EmptyState } from "@/components/ui";
import { VentasHistorial } from "@/components/sucursal/VentasHistorial";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const session = await getSession();
  await connectDB();

  const ventas = await Venta.find({ sucursalId: session?.sucursalId }).sort({ createdAt: -1 }).limit(200).lean();

  const hoy = new Date().toISOString().slice(0, 10);
  const ventasHoy = ventas.filter((v) => v.corte === hoy && v.estado === "completada");
  const totalHoy = ventasHoy.reduce((sum, v) => sum + v.total, 0);

  return (
    <div>
      <PageHeader title="Historial de ventas" description="Ventas registradas en el punto de venta" />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-black/50">Ventas de hoy</p>
          <p className="mt-1 text-2xl font-bold text-titos-green-900">{ventasHoy.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-black/50">Total cobrado hoy</p>
          <p className="mt-1 text-2xl font-bold text-titos-green-900">{formatMoney(totalHoy)}</p>
        </Card>
      </div>

      {ventas.length === 0 ? (
        <Card>
          <EmptyState message="Todavía no se han registrado ventas." />
        </Card>
      ) : (
        <VentasHistorial ventas={JSON.parse(JSON.stringify(ventas))} />
      )}
    </div>
  );
}
