import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { UsuariosManager } from "@/components/sucursal/UsuariosManager";

export default function UsuariosSucursalPage() {
  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Crea y administra los usuarios de tu sucursal y sus roles de acceso"
        icon={Users}
      />
      <UsuariosManager />
    </div>
  );
}
