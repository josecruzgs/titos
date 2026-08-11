import { redirect } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { getSession } from "@/lib/getSession";
import { PageHeader } from "@/components/ui";
import { PrestamosManager } from "@/components/sucursal/PrestamosManager";

export const dynamic = "force-dynamic";

export default async function PrestamosSucursalPage() {
  const session = await getSession();
  if (!session?.sucursalId) redirect("/login");

  return (
    <div>
      <PageHeader
        title="Préstamos entre sucursales"
        description="Consulta el stock de otras sucursales, pide prestado lo que te falta y registra la devolución"
        icon={ArrowLeftRight}
      />
      <PrestamosManager sucursalId={session.sucursalId} />
    </div>
  );
}
