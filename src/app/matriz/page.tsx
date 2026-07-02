import Link from "next/link";
import { connectDB } from "@/lib/db";
import Pedido from "@/models/Pedido";
import Producto from "@/models/Producto";
import NecesidadCompra from "@/models/NecesidadCompra";
import OrdenCompra from "@/models/OrdenCompra";
import SolicitudProductoNuevo from "@/models/SolicitudProductoNuevo";
import "@/models/Sucursal"; // necesario para que populate("sucursalId") funcione
import { Card, PageHeader, Button, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MatrizDashboard() {
  await connectDB();

  const [pedidosPendientes, pedidosNivelados, necesidadesPendientes, ocEnCurso, solicitudesPendientes, productos] =
    await Promise.all([
      Pedido.find({ estado: "pendiente" }).populate("sucursalId", "nombre").lean(),
      Pedido.find({ estado: "nivelado" }).populate("sucursalId", "nombre").lean(),
      NecesidadCompra.countDocuments({ estado: "pendiente" }),
      OrdenCompra.countDocuments({ estado: { $in: ["borrador", "solicitada"] } }),
      SolicitudProductoNuevo.countDocuments({ estado: "pendiente" }),
      Producto.find({ activo: true }).lean(),
    ]);

  const stockBajo = productos.filter((p) => p.stockMinimo > 0 && p.existenciaMatriz <= p.stockMinimo);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Resumen operativo del almacén central"
        action={
          <Link href="/matriz/pedidos">
            <Button>Ir a pedidos de sucursales</Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <p className="text-sm text-black/50">Pedidos por nivelar</p>
          <p className="mt-1 text-3xl font-bold text-titos-green-700">{pedidosPendientes.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-black/50">Nivelados, listos para surtir</p>
          <p className="mt-1 text-3xl font-bold text-titos-orange-600">{pedidosNivelados.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-black/50">Necesidades por ordenar</p>
          <p className="mt-1 text-3xl font-bold text-titos-green-700">{necesidadesPendientes}</p>
        </Card>
        <Card>
          <p className="text-sm text-black/50">Órdenes de compra en curso</p>
          <p className="mt-1 text-3xl font-bold text-titos-green-700">{ocEnCurso}</p>
        </Card>
        <Card>
          <p className="text-sm text-black/50">Solicitudes de producto nuevo</p>
          <p className="mt-1 text-3xl font-bold text-titos-orange-600">{solicitudesPendientes}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-titos-green-900">Pedidos pendientes de corte</h2>
          {pedidosPendientes.length === 0 ? (
            <EmptyState message="No hay pedidos pendientes en este momento." />
          ) : (
            <ul className="divide-y divide-black/5">
              {pedidosPendientes.map((p) => (
                <li key={p._id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="font-medium">{(p.sucursalId as { nombre?: string })?.nombre ?? "Sucursal"}</span>{" "}
                    <span className="text-black/40">· {p.folio}</span>
                  </span>
                  <span className="text-black/50">{p.items.length} productos</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-titos-green-900">Alertas de stock bajo</h2>
          {stockBajo.length === 0 ? (
            <EmptyState message="Ningún producto por debajo de su mínimo." />
          ) : (
            <ul className="divide-y divide-black/5">
              {stockBajo.map((p) => (
                <li key={p._id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{p.nombre}</span>
                  <span className="text-red-600">
                    {p.existenciaMatriz} {p.unidad} (mín. {p.stockMinimo})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
