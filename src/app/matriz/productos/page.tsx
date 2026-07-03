import { Package } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ProductosManager } from "@/components/matriz/ProductosManager";

export default function ProductosPage() {
  return (
    <div>
      <PageHeader
        title="Productos"
        description="Catálogo central de productos que la matriz distribuye a las sucursales"
        icon={Package}
      />
      <ProductosManager />
    </div>
  );
}
