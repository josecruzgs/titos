import { PageHeader } from "@/components/ui";
import { PuntoVentaForm } from "@/components/sucursal/PuntoVentaForm";

export default function SucursalPuntoVenta() {
  return (
    <div>
      <PageHeader title="Punto de venta" description="Escanea o busca productos para registrar una venta" />
      <PuntoVentaForm />
    </div>
  );
}
