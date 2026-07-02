import { PageHeader } from "@/components/ui";
import { SucursalesManager } from "@/components/matriz/SucursalesManager";

export default function SucursalesPage() {
  return (
    <div>
      <PageHeader title="Sucursales" description="Alta de sucursales y su usuario de acceso limitado" />
      <SucursalesManager />
    </div>
  );
}
