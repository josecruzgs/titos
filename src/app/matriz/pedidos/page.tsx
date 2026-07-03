import { Suspense } from "react";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { PedidosManager } from "@/components/matriz/PedidosManager";

export default function PedidosPage() {
  return (
    <div>
      <PageHeader
        title="Pedidos de sucursales"
        description="Corte de pedidos, Nivelador y surtido con captura de peso para perecederos"
        icon={ClipboardList}
      />
      <Suspense>
        <PedidosManager />
      </Suspense>
    </div>
  );
}
