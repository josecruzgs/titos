import { Ban } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { CancelacionesManager } from "@/components/matriz/CancelacionesManager";

export const dynamic = "force-dynamic";

export default function CancelacionesPage() {
  return (
    <div>
      <PageHeader
        title="Cancelaciones"
        description="Todo lo que se cancela en los puntos de venta de matriz y sucursales, con su motivo y quién lo hizo"
        icon={Ban}
      />
      <CancelacionesManager />
    </div>
  );
}
