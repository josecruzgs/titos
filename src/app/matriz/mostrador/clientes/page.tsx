import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ClientesManager } from "@/components/sucursal/ClientesManager";

export default function ClientesMostradorPage() {
  return (
    <div>
      <PageHeader
        title="Clientes del mostrador"
        description="Clientes frecuentes que compran directo en matriz: su crédito, sus fechas de pago y su estado de cuenta"
        icon={Users}
      />
      <ClientesManager />
    </div>
  );
}
