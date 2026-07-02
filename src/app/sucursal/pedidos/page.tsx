import Link from "next/link";
import { getSession } from "@/lib/getSession";
import { connectDB } from "@/lib/db";
import Pedido from "@/models/Pedido";
import { Card, PageHeader, EstadoBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MisPedidosPage() {
  const session = await getSession();
  await connectDB();

  const pedidos = await Pedido.find({ sucursalId: session?.sucursalId }).sort({ createdAt: -1 }).lean();

  return (
    <div>
      <PageHeader title="Mis pedidos" description="Historial de pedidos hechos a la matriz" />
      <Card>
        {pedidos.length === 0 ? (
          <EmptyState message="Todavía no has hecho pedidos." />
        ) : (
          <ul className="divide-y divide-black/5">
            {pedidos.map((p) => (
              <li key={p._id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <Link href={`/sucursal/pedidos/${p._id}`} className="font-medium hover:underline">
                    {p.folio}
                  </Link>
                  <p className="text-xs text-black/40">
                    corte {p.corte} · {p.items.length} productos
                  </p>
                </div>
                <EstadoBadge estado={p.estado} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
