import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ClientesManager } from "@/components/sucursal/ClientesManager";

export default function ClientesSucursalPage() {
  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Da de alta a tus clientes frecuentes, define su crédito y sus fechas de pago, y lleva su estado de cuenta"
        icon={Users}
      />
      <ClientesManager />
    </div>
  );
}
