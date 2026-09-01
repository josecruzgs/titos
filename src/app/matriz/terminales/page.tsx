import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { TerminalesManager } from "@/components/matriz/TerminalesManager";

export default function TerminalesPage() {
  return (
    <div>
      <PageHeader
        title="Terminales de pago"
        description="Las terminales bancarias de cada sucursal: el punto de venta registra con cuál se cobró y el corte las desglosa"
        icon={CreditCard}
      />
      <TerminalesManager />
    </div>
  );
}
