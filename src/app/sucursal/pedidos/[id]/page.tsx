import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/getSession";
import { connectDB } from "@/lib/db";
import Pedido from "@/models/Pedido";
import { Card, PageHeader, EstadoBadge } from "@/components/ui";
import { RecepcionForm } from "@/components/sucursal/RecepcionForm";

export const dynamic = "force-dynamic";

export default async function DetallePedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  await connectDB();
  const pedido = await Pedido.findById(id).lean();
  if (!pedido || String(pedido.sucursalId) !== session.sucursalId) notFound();

  return (
    <div>
      <PageHeader
        title={pedido.folio}
        description={`Corte ${pedido.corte}`}
        action={<EstadoBadge estado={pedido.estado} />}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-black/50">
                <th className="py-2 pr-2">Producto</th>
                <th className="py-2 pr-2">Pedido</th>
                <th className="py-2 pr-2">Asignado</th>
                <th className="py-2 pr-2">Surtido</th>
                <th className="py-2 pr-2">Recibido</th>
              </tr>
            </thead>
            <tbody>
              {pedido.items.map((item: (typeof pedido.items)[number]) => (
                <tr key={item.productoId?.toString()} className="border-b border-black/5">
                  <td className="py-2 pr-2 font-medium">
                    {item.nombreProducto}
                    {item.requierePesaje ? <span className="ml-1 text-xs text-titos-orange-600">(pesaje)</span> : null}
                  </td>
                  <td className="py-2 pr-2">
                    {item.cantidadPedida} {item.unidad}
                  </td>
                  <td className="py-2 pr-2">{item.cantidadAsignada ?? "—"}</td>
                  <td className="py-2 pr-2">
                    {item.cantidadSurtida ?? "—"}
                    {item.pesoSurtidoKg ? ` (${item.pesoSurtidoKg} kg)` : ""}
                  </td>
                  <td className="py-2 pr-2">
                    {item.cantidadRecibida ?? "—"}
                    {item.pesoRecibidoKg ? ` (${item.pesoRecibidoKg} kg)` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pedido.estado === "surtido" ? (
          <RecepcionForm
            pedidoId={String(pedido._id)}
            items={pedido.items.map((i: (typeof pedido.items)[number]) => ({
              productoId: String(i.productoId),
              nombreProducto: i.nombreProducto,
              unidad: i.unidad,
              requierePesaje: i.requierePesaje,
              cantidadSurtida: i.cantidadSurtida ?? null,
            }))}
          />
        ) : null}
      </Card>
    </div>
  );
}
