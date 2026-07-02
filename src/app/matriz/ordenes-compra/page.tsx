import { PageHeader } from "@/components/ui";
import { OrdenesCompraManager } from "@/components/matriz/OrdenesCompraManager";

export default function OrdenesCompraPage() {
  return (
    <div>
      <PageHeader
        title="Órdenes de compra"
        description="Arma órdenes por proveedor a partir de lo faltante, envíalas y registra la recepción real"
      />
      <OrdenesCompraManager />
    </div>
  );
}
