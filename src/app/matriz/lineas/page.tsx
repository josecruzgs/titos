import { Tags } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { LineasManager } from "@/components/matriz/LineasManager";

export default function LineasPage() {
  return (
    <div>
      <PageHeader
        title="Líneas"
        description="Marcas o líneas de producto usadas para clasificar el catálogo"
        icon={Tags}
      />
      <LineasManager />
    </div>
  );
}
