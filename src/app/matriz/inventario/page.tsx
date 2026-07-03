import { Warehouse } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { InventarioManager } from "@/components/matriz/InventarioManager";

export default function InventarioPage() {
  return (
    <div>
      <PageHeader
        title="Inventario central"
        description="Registra la entrada de mercancía de proveedores. Los perecederos requieren pesaje en báscula."
        icon={Warehouse}
      />
      <InventarioManager />
    </div>
  );
}
