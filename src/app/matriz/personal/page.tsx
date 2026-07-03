import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { PersonalManager } from "@/components/matriz/PersonalManager";

export default function PersonalPage() {
  return (
    <div>
      <PageHeader
        title="Personal"
        description="Empleados de la matriz que reparten pedidos o reciben mercancía de proveedores"
        icon={Users}
      />
      <PersonalManager />
    </div>
  );
}
