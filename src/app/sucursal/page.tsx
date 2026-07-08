import Link from "next/link";
import { getSession } from "@/lib/getSession";
import { connectDB } from "@/lib/db";
import Pedido from "@/models/Pedido";
import { Card, PageHeader, Button, EstadoBadge, EmptyState, formatMoney } from "@/components/ui";
import { montoLineaPedido } from "@/lib/montoPedido";

export const dynamic = "force-dynamic";

export default async function SucursalDashboard() {
  const session = await getSession();
  await connectDB();

  const activos = await Pedido.find({ sucursalId: session?.sucursalId, estado: { $ne: "recibido" } })
    .sort({ createdAt: -1 })
    .lean();

  const enProceso = activos.filter((p) => p.estado === "pendiente" || p.estado === "nivelado").length;
  const listosParaRecibir = activos.filter((p) => p.estado === "surtido").length;
  const montoActivo = activos.reduce(
    (sum, p) => sum + p.items.reduce((s: number, i: (typeof p.items)[number]) => s + montoLineaPedido(i), 0),
    0
  );

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Estado de tus pedidos a la matriz"
        action={
          <Link href="/sucursal/nuevo-pedido">
            <Button>Levantar nuevo pedido</Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-sm text-black/50">Pedidos activos</p>
          <p className="mt-1 text-2xl font-bold text-titos-green-900">{activos.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-black/50">En proceso en matriz</p>
          <p className="mt-1 text-2xl font-bold text-sky-700">{enProceso}</p>
        </Card>
        <Card>
          <p className="text-sm text-black/50">Listos para recibir</p>
          <p className="mt-1 text-2xl font-bold text-titos-orange-600">{listosParaRecibir}</p>
        </Card>
        <Card>
          <p className="text-sm text-black/50">Monto en pedidos activos</p>
          <p className="mt-1 text-2xl font-bold text-titos-green-900">{formatMoney(montoActivo)}</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-titos-green-900">Pedidos activos</h2>
        {activos.length === 0 ? (
          <EmptyState message="No tienes pedidos activos en este momento." />
        ) : (
          <ul className="divide-y divide-black/5">
            {activos.slice(0, 8).map((p) => (
              <li key={p._id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/sucursal/pedidos/${p._id}`} className="font-medium hover:underline">
                  {p.folio}
                </Link>
                <span className="flex items-center gap-3 text-black/50">
                  {p.items.length} productos
                  <EstadoBadge estado={p.estado} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs text-black/40">
        Recuerda: los pedidos levantados antes de las 4:00 pm se surten al día siguiente.
      </p>
    </div>
  );
}
