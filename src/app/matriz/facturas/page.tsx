import { ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { FacturasManager } from "@/components/matriz/FacturasManager";

export const dynamic = "force-dynamic";

export default function FacturasPage() {
  return (
    <div>
      <PageHeader
        title="Facturas"
        description="Convierte las notas de venta del punto de venta en facturas y llévales seguimiento"
        icon={ReceiptText}
      />
      <FacturasManager />
    </div>
  );
}
