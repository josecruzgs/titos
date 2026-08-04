import { redirect } from "next/navigation";
import { getSession } from "@/lib/getSession";
import { Sidebar } from "@/components/Sidebar";
import { SucursalMain } from "@/components/sucursal/SucursalMain";
import { connectDB } from "@/lib/db";
import Sucursal from "@/models/Sucursal";

export default async function SucursalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "sucursal") redirect("/login");

  await connectDB();
  const sucursal = await Sucursal.findById(session.sucursalId).select("nombre").lean();
  const sucursalNombre = (sucursal as { nombre?: string } | null)?.nombre ?? "";
  const sucursalRol = session.sucursalRol === "ventas" ? "ventas" : "admin";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar role="sucursal" nombre={session.nombre} sucursalNombre={sucursalNombre} sucursalRol={sucursalRol} />
      <SucursalMain>{children}</SucursalMain>
    </div>
  );
}
