import { connectDB } from "@/lib/db";
import Pedido from "@/models/Pedido";
import "@/models/Sucursal"; // necesario para que populate("sucursalId") funcione
import { BarChart3 } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { ReportesManager } from "@/components/matriz/ReportesManager";

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

  return (
    <div>
      <PageHeader
        title="Reportes"
        description="Comparativo de lo pedido, lo asignado por el Nivelador, lo surtido y lo recibido"
        icon={BarChart3}
      />

      {filas.length === 0 ? <EmptyState message="Todavía no hay pedidos nivelados para reportar." /> : <ReportesManager filas={filas} />}
    </div>
  );
}
