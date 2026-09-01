import { UserCog } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { UsuariosRolesManager } from "@/components/matriz/UsuariosRolesManager";

export default function UsuariosPage() {
  return (
    <div>
      <PageHeader
        title="Usuarios y roles"
        description="Alta de usuarios de matriz y de todas las sucursales, y qué puede hacer cada rol"
        icon={UserCog}
      />
      <UsuariosRolesManager />
    </div>
  );
}
