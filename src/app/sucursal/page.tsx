import Link from "next/link";
import { getSession } from "@/lib/getSession";
import { connectDB } from "@/lib/db";
import Pedido from "@/models/Pedido";
import { Card, PageHeader, Button, EstadoBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SucursalDashboard() {
  const session = await getSession();
  await connectDB();

  const pedidos = await Pedido.find({ sucursalId: session?.sucursalId })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();

  const activos = pedidos.filter((p) => p.estado !== "recibido");

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

      <Card>
        <h2 className="mb-3 font-semibold text-titos-green-900">Pedidos activos</h2>
        {activos.length === 0 ? (
          <EmptyState message="No tienes pedidos activos en este momento." />
        ) : (
          <ul className="divide-y divide-black/5">
            {activos.map((p) => (
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
