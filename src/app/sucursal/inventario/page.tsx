import { getSession } from "@/lib/getSession";
import { connectDB } from "@/lib/db";
import InventarioSucursal from "@/models/InventarioSucursal";
import "@/models/Producto"; // necesario para que populate("productoId") funcione
import { Card, PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InventarioSucursalPage() {
  const session = await getSession();
  await connectDB();

  const inventario = await InventarioSucursal.find({ sucursalId: session?.sucursalId })
    .populate("productoId", "nombre sku unidad categoria requierePesaje")
    .lean();

  const conProducto = inventario.filter((i) => i.productoId);

  return (
    <div>
      <PageHeader title="Mi inventario" description="Existencia actual en tu sucursal, según lo recibido" />
      <Card>
        {conProducto.length === 0 ? (
          <EmptyState message="Todavía no has recibido mercancía." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-black/50">
                <th className="py-2 pr-2">Producto</th>
                <th className="py-2 pr-2">Categoría</th>
                <th className="py-2 pr-2">Existencia</th>
              </tr>
            </thead>
            <tbody>
              {conProducto.map((i) => {
                const producto = i.productoId as unknown as {
                  nombre: string;
                  unidad: string;
                  categoria: string;
                };
                return (
                  <tr key={i._id} className="border-b border-black/5">
                    <td className="py-2 pr-2 font-medium">{producto.nombre}</td>
                    <td className="py-2 pr-2 capitalize text-black/60">{producto.categoria.replaceAll("_", " ")}</td>
                    <td className="py-2 pr-2">
                      {i.existencia} {producto.unidad}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
