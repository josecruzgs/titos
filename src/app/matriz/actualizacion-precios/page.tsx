import { BadgeDollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ActualizacionPreciosManager } from "@/components/matriz/ActualizacionPreciosManager";

export default function ActualizacionPreciosPage() {
  return (
    <div>
      <PageHeader
        title="Actualización de precios"
        description="Importa precios desde Excel o actualízalos uno por uno, y exporta en PDF los cambios para avisar a las sucursales"
        icon={BadgeDollarSign}
      />
      <ActualizacionPreciosManager />
    </div>
  );
}
