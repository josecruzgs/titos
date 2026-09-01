import { getSession } from "@/lib/getSession";
import { connectDB } from "@/lib/db";
import Venta from "@/models/Venta";
import Sucursal from "@/models/Sucursal";
import { PageHeader, Card, formatMoney, EmptyState } from "@/components/ui";
import { VentasHistorial } from "@/components/sucursal/VentasHistorial";
import { zonaHorariaDeSucursal } from "@/lib/credito";
import { fechaEnZona } from "@/lib/zonasHorarias";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const session = await getSession();
  await connectDB();

  const ventas = await Venta.find({ sucursalId: session?.sucursalId, esVentas2: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  // El "hoy" tiene que coincidir con el corte que sella la venta, que se
  // calcula en la zona de la sucursal (no en la del servidor).
  const sucursal = await Sucursal.findById(session?.sucursalId).select("nombre").lean();

  const hoy = fechaEnZona(new Date(), await zonaHorariaDeSucursal(session?.sucursalId));
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
        <VentasHistorial
          ventas={JSON.parse(JSON.stringify(ventas))}
          sucursalNombre={sucursal?.nombre ?? ""}
        />
      )}
    </div>
  );
}
