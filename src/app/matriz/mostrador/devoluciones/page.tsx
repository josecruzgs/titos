import { RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { DevolucionesManager } from "@/components/sucursal/DevolucionesManager";

export default function DevolucionesMostradorPage() {
  return (
    <div>
      <PageHeader
        title="Devoluciones del mostrador"
        description="Devuelve productos de una venta de matriz dentro de las primeras 48 horas y reembolsa al cliente"
        icon={RotateCcw}
      />
      <DevolucionesManager />
    </div>
  );
}
