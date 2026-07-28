import { redirect } from "next/navigation";
import { getSession } from "@/lib/getSession";
import { Sidebar } from "@/components/Sidebar";
import { connectDB } from "@/lib/db";
import Sucursal from "@/models/Sucursal";

export default async function SucursalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "sucursal") redirect("/login");

  await connectDB();
  const sucursal = await Sucursal.findById(session.sucursalId).select("nombre").lean();
  const sucursalNombre = (sucursal as { nombre?: string } | null)?.nombre ?? "";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar role="sucursal" nombre={session.nombre} sucursalNombre={sucursalNombre} />
      <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
