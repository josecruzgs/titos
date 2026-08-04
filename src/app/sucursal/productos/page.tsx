import { Package } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ProductosSucursal } from "@/components/sucursal/ProductosSucursal";

export default function ProductosSucursalPage() {
  return (
    <div>
      <PageHeader
        title="Productos"
        description="Catálogo de productos con la existencia actual de tu sucursal"
        icon={Package}
      />
      <ProductosSucursal />
    </div>
  );
}
