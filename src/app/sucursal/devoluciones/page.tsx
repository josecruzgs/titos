import { RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { DevolucionesManager } from "@/components/sucursal/DevolucionesManager";

export default function DevolucionesSucursalPage() {
  return (
    <div>
      <PageHeader
        title="Devoluciones"
        description="Devuelve productos de una venta dentro de las primeras 48 horas y reembolsa al cliente"
        icon={RotateCcw}
      />
      <DevolucionesManager />
    </div>
  );
}
