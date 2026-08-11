import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { Ventas2Manager } from "@/components/matriz/Ventas2Manager";

export const dynamic = "force-dynamic";

export default function Ventas2MatrizPage() {
  return (
    <div>
      <PageHeader
        title="Notas de venta"
        description="Activa el protocolo por sucursal, define el lapso y consulta lo recaudado"
        icon={Banknote}
      />
      <Ventas2Manager />
    </div>
  );
}
