import { Suspense } from "react";
import { ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { OrdenesCompraManager } from "@/components/matriz/OrdenesCompraManager";

export default function OrdenesCompraPage() {
  return (
    <div>
      <PageHeader
        title="Órdenes de compra"
        description="Arma órdenes por proveedor a partir de lo faltante, envíalas y registra la recepción real"
        icon={ShoppingCart}
      />
      <Suspense>
        <OrdenesCompraManager />
      </Suspense>
    </div>
  );
}
