import { Ticket } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ValesManager } from "@/components/matriz/ValesManager";

export default function ValesPage() {
  return (
    <div>
      <PageHeader
        title="Vales de despensa"
        description="Emisores de vales y los BIN con los que el punto de venta reconoce cada tarjeta"
        icon={Ticket}
      />
      <ValesManager />
    </div>
  );
}
