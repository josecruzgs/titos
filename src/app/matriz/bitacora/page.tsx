import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { BitacoraManager } from "@/components/matriz/BitacoraManager";

export default function BitacoraPage() {
  return (
    <div>
      <PageHeader
        title="Bitácora"
        description="Quién hizo cada acción crítica: cancelaciones, devoluciones, retiros, surtidos, recepciones y préstamos"
        icon={ScrollText}
      />
      <BitacoraManager />
    </div>
  );
}
