import { connectDB } from "@/lib/db";
import Pedido from "@/models/Pedido";
import "@/models/Sucursal"; // necesario para que populate("sucursalId") funcione
import { Card, PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

type Fila = {
  sucursal: string;
  producto: string;
  pedido: number;
  asignado: number;
  surtido: number;
  recibido: number;
};

export default async function ReportesPage() {
  await connectDB();

  const pedidos = await Pedido.find({ estado: { $ne: "pendiente" } })
    .populate("sucursalId", "nombre")
    .sort({ corte: -1 })
    .lean();

  const filas: Fila[] = [];
  for (const pedido of pedidos) {
    const sucursal = (pedido.sucursalId as unknown as { nombre?: string })?.nombre ?? "Sucursal";
    for (const item of pedido.items) {
      filas.push({
        sucursal,
        producto: item.nombreProducto,
        pedido: item.cantidadPedida,
        asignado: item.cantidadAsignada ?? 0,
        surtido: item.cantidadSurtida ?? 0,
        recibido: item.cantidadRecibida ?? 0,
      });
    }
  }

  const totales = filas.reduce(
    (acc, f) => ({
      pedido: acc.pedido + f.pedido,
      asignado: acc.asignado + f.asignado,
      surtido: acc.surtido + f.surtido,
      recibido: acc.recibido + f.recibido,
    }),
    { pedido: 0, asignado: 0, surtido: 0, recibido: 0 }
  );

  return (
    <div>
      <PageHeader
        title="Reportes"
        description="Comparativo de lo pedido, lo asignado por el Nivelador, lo surtido y lo recibido"
      />

      {filas.length === 0 ? (
        <EmptyState message="Todavía no hay pedidos nivelados para reportar." />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <p className="text-sm text-black/50">Total pedido</p>
              <p className="mt-1 text-2xl font-bold text-titos-green-900">{totales.pedido}</p>
            </Card>
            <Card>
              <p className="text-sm text-black/50">Total nivelado/asignado</p>
              <p className="mt-1 text-2xl font-bold text-sky-700">{totales.asignado}</p>
            </Card>
            <Card>
              <p className="text-sm text-black/50">Total surtido</p>
              <p className="mt-1 text-2xl font-bold text-titos-orange-600">{totales.surtido}</p>
            </Card>
            <Card>
              <p className="text-sm text-black/50">Total recibido</p>
              <p className="mt-1 text-2xl font-bold text-titos-green-700">{totales.recibido}</p>
            </Card>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-black/50">
                    <th className="py-2 pr-2">Sucursal</th>
                    <th className="py-2 pr-2">Producto</th>
                    <th className="py-2 pr-2">Pedido</th>
                    <th className="py-2 pr-2">Asignado (Nivelador)</th>
                    <th className="py-2 pr-2">Surtido</th>
                    <th className="py-2 pr-2">Recibido</th>
                    <th className="py-2 pr-2">Diferencia pedido vs. asignado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={i} className="border-b border-black/5">
                      <td className="py-2 pr-2">{f.sucursal}</td>
                      <td className="py-2 pr-2 font-medium">{f.producto}</td>
                      <td className="py-2 pr-2">{f.pedido}</td>
                      <td className="py-2 pr-2">{f.asignado}</td>
                      <td className="py-2 pr-2">{f.surtido}</td>
                      <td className="py-2 pr-2">{f.recibido}</td>
                      <td className="py-2 pr-2">
                        {f.pedido - f.asignado > 0 ? (
                          <span className="text-amber-600">-{f.pedido - f.asignado}</span>
                        ) : (
                          <span className="text-black/30">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
