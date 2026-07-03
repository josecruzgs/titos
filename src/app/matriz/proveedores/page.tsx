import { Truck } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ProveedoresManager } from "@/components/matriz/ProveedoresManager";

export default function ProveedoresPage() {
  return (
    <div>
      <PageHeader
        title="Proveedores"
        description="Empresas a las que se les compra mercancía para reabastecer el almacén"
        icon={Truck}
      />
      <ProveedoresManager />
    </div>
  );
}
