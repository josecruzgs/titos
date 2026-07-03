import Link from "next/link";
import { getSession } from "@/lib/getSession";
import { connectDB } from "@/lib/db";
import Pedido from "@/models/Pedido";
import { Card, PageHeader, EstadoBadge, EmptyState, formatMoney } from "@/components/ui";

export const dynamic = "force-dynamic";

function montoLinea(item: { cantidadSurtida?: number | null; cantidadAsignada?: number | null; cantidadPedida: number; precioVenta?: number }) {
  const cantidad = item.cantidadSurtida ?? item.cantidadAsignada ?? item.cantidadPedida;
  return cantidad * (item.precioVenta ?? 0);
}

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
                <div className="flex items-center gap-3">
                  <span className="font-medium text-titos-green-900">
                    {formatMoney(p.items.reduce((sum: number, i: (typeof p.items)[number]) => sum + montoLinea(i), 0))}
                  </span>
                  <EstadoBadge estado={p.estado} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
