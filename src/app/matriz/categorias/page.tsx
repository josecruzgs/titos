import { Tag } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { CategoriasManager } from "@/components/matriz/CategoriasManager";

export default function CategoriasPage() {
  return (
    <div>
      <PageHeader
        title="Categorías"
        description="Tipos de producto usados para clasificar y filtrar el catálogo"
        icon={Tag}
      />
      <CategoriasManager />
    </div>
  );
}
