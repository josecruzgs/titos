import { Settings } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ConfiguracionManager } from "@/components/matriz/ConfiguracionManager";

export default function ConfiguracionPage() {
  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Ajustes generales del sistema: conexión de WhatsApp, días y horario laborales"
        icon={Settings}
      />
      <ConfiguracionManager />
    </div>
  );
}
