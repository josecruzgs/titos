import { connectDB } from "@/lib/db";
import Venta from "@/models/Venta";
import { PageHeader, Card, formatMoney, EmptyState } from "@/components/ui";
import { VentasHistorial } from "@/components/sucursal/VentasHistorial";
import { obtenerMostradorMatriz } from "@/lib/puntoVenta";
import { zonaHorariaDeSucursal } from "@/lib/credito";
import { fechaEnZona } from "@/lib/zonasHorarias";

export const dynamic = "force-dynamic";

export default async function VentasMostradorPage() {
  await connectDB();
  const mostrador = await obtenerMostradorMatriz();

  const ventas = await Venta.find({ sucursalId: mostrador._id, esVentas2: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  // El "hoy" tiene que coincidir con el corte que sella la venta, que se
  // calcula en la zona del mostrador (no en la del servidor).
  const hoy = fechaEnZona(new Date(), await zonaHorariaDeSucursal(String(mostrador._id)));
  const ventasHoy = ventas.filter((v) => v.corte === hoy && v.estado === "completada");
  const totalHoy = ventasHoy.reduce((sum, v) => sum + v.total, 0);

  return (
    <div>
      <PageHeader title="Historial de ventas" description="Ventas registradas en el mostrador de matriz" />

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
          <EmptyState message="Todavía no se han registrado ventas en el mostrador." />
        </Card>
      ) : (
        <VentasHistorial ventas={JSON.parse(JSON.stringify(ventas))} />
      )}
    </div>
  );
}
