import { redirect } from "next/navigation";
import { getSession } from "@/lib/getSession";
import { connectDB } from "@/lib/db";
import Sucursal from "@/models/Sucursal";
import { PageHeader } from "@/components/ui";
import { AjustesSucursalForm } from "@/components/sucursal/AjustesSucursalForm";

export const dynamic = "force-dynamic";

export default async function AjustesSucursalPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  await connectDB();
  const sucursal = await Sucursal.findById(session.sucursalId).lean();
  if (!sucursal) redirect("/sucursal");

  return (
    <div>
      <PageHeader title="Ajustes" description="Datos de contacto de tu sucursal" />
      <AjustesSucursalForm
        sucursalId={String(sucursal._id)}
        direccionInicial={sucursal.direccion ?? ""}
        whatsappInicial={sucursal.whatsapp ?? ""}
      />
    </div>
  );
}
