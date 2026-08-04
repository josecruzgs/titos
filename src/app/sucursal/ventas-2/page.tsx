import { Banknote } from "lucide-react";
import { getSession } from "@/lib/getSession";
import { connectDB } from "@/lib/db";
import Ventas2Activacion from "@/models/Ventas2Activacion";
import { PageHeader, Card, EmptyState, formatMoney } from "@/components/ui";
import { resumirActivacionesVentas2, sincronizarVentas2 } from "@/lib/ventas2";

export const dynamic = "force-dynamic";

function formatoFecha(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function estadoClase(estado: string) {
  if (estado === "activa") return "bg-titos-green-100 text-titos-green-700";
  if (estado === "finalizada") return "bg-black/5 text-black/60";
  if (estado === "programada") return "bg-sky-100 text-sky-800";
  return "bg-red-100 text-red-700";
}

export default async function Ventas2SucursalPage() {
  const session = await getSession();
  await connectDB();

  const ahora = new Date();
  await sincronizarVentas2(ahora);

  const activaciones = await Ventas2Activacion.find({ sucursalId: session?.sucursalId, estado: { $ne: "cancelada" } })
    .sort({ inicio: -1 })
    .limit(50)
    .populate("sucursalId", "nombre")
    .lean();
  const resumen = await resumirActivacionesVentas2(activaciones, ahora);

  const activa = resumen.find((a) => a.estado === "activa");
  const totalPendiente = resumen
    .filter((a) => !a.retiradoEn)
    .reduce((sum, a) => sum + a.totalRecaudado, 0);
  const totalHoy = resumen.reduce((sum, a) => {
    const hoy = new Date().toISOString().slice(0, 10);
    return (
      sum +
      a.movimientos
        .filter((m) => m.estado === "completada" && m.fecha.slice(0, 10) === hoy)
        .reduce((movSum, m) => movSum + m.total, 0)
    );
  }, 0);

  return (
    <div>
      <PageHeader
        title="Ventas 2"
        description="Movimientos separados por el protocolo Ventas 2"
        icon={Banknote}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-black/50">Estado actual</p>
          <p className="mt-1 text-2xl font-bold text-titos-green-900">{activa ? "Activo" : "Sin activar"}</p>
        </Card>
        <Card>
          <p className="text-sm text-black/50">Ventas 2 de hoy</p>
          <p className="mt-1 text-2xl font-bold text-titos-green-900">{formatMoney(totalHoy)}</p>
        </Card>
        <Card>
          <p className="text-sm text-black/50">Efectivo pendiente</p>
          <p className="mt-1 text-2xl font-bold text-titos-orange-600">{formatMoney(totalPendiente)}</p>
        </Card>
      </div>

      {resumen.length === 0 ? (
        <Card>
          <EmptyState message="No hay movimientos ni activaciones de Ventas 2 para esta sucursal." />
        </Card>
      ) : (
        <div className="space-y-5">
          {resumen.map((activacion) => (
            <Card key={activacion.id}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${estadoClase(activacion.estado)}`}>
                      {activacion.estado}
                    </span>
                    {activacion.retiradoEn ? (
                      <span className="rounded-full bg-titos-green-100 px-2.5 py-0.5 text-xs font-semibold text-titos-green-700">
                        Retirado por matriz
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-black/50">
                    Lapso: {formatoFecha(activacion.inicio)} a {formatoFecha(activacion.fin)}
                  </p>
                  <p className="text-sm text-black/50">
                    Regla: 1 de cada {activacion.frecuencia} ventas 100% en efectivo
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-black/50">Total Ventas 2</p>
                  <p className="text-2xl font-bold text-titos-green-900">{formatMoney(activacion.totalRecaudado)}</p>
                </div>
              </div>

              {activacion.movimientos.length === 0 ? (
                <EmptyState message="Todavia no hay ventas asignadas a este lapso." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-black/50">
                        <th className="py-2 pr-3">Hora</th>
                        <th className="py-2 pr-3">Folio</th>
                        <th className="py-2 pr-3">Secuencia</th>
                        <th className="py-2 pr-3">Monto</th>
                        <th className="py-2 pr-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activacion.movimientos.map((mov) => (
                        <tr key={mov.id} className="border-b border-black/5">
                          <td className="py-2 pr-3 text-black/60">{formatoFecha(mov.fecha)}</td>
                          <td className="py-2 pr-3 font-medium text-titos-green-900">{mov.folio}</td>
                          <td className="py-2 pr-3 text-black/60">
                            {mov.secuenciaEfectivo ? `${mov.secuenciaEfectivo}a venta en efectivo` : "-"}
                          </td>
                          <td className="py-2 pr-3 font-semibold">{formatMoney(mov.total)}</td>
                          <td className="py-2 pr-3 capitalize text-black/60">{mov.estado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
