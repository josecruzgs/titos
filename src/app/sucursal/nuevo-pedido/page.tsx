import { PageHeader } from "@/components/ui";
import { NuevoPedidoForm } from "@/components/sucursal/NuevoPedidoForm";

export default function NuevoPedidoPage() {
  return (
    <div>
      <PageHeader
        title="Nuevo pedido"
        description="Pide productos existentes en el catálogo o solicita productos nuevos"
      />
      <NuevoPedidoForm />
    </div>
  );
}
