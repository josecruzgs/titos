"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CalendarClock, Check, Clock, MessageCircleWarning, RefreshCw, SquareCheckBig } from "lucide-react";
import { Button, Card, EmptyState, FormField, Input, formatMoney } from "@/components/ui";

type Sucursal = {
  _id: string;
  nombre: string;
  whatsapp: string;
  activo: boolean;
};

type MovimientoVentas2 = {
  id: string;
  folio: string;
  fecha: string;
  total: number;
  estado: string;
  secuenciaEfectivo: number | null;
};

type ActivacionVentas2 = {
  id: string;
  sucursalId: string;
  sucursalNombre: string;
  inicio: string;
  fin: string;
  frecuencia: number;
  estado: "programada" | "activa" | "finalizada" | "cancelada";
  totalRecaudado: number;
  cantidadMovimientos: number;
  ultimoMovimiento: string | null;
  notificacionInicio: { estado: string; fecha: string | null; error: string };
  notificacionFin: { estado: string; fecha: string | null; error: string };
  retiradoEn: string | null;
  movimientos: MovimientoVentas2[];
};

function datetimeLocal(fecha: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
}

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

function avisoLabel(notificacion: { estado: string; error: string }) {
  if (notificacion.estado === "enviada") return "Enviada";
  if (notificacion.estado === "sin_whatsapp") return "Sin WhatsApp";
  if (notificacion.estado === "fallida") return "Fallida";
  return "Pendiente";
}

export function Ventas2Manager() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [activaciones, setActivaciones] = useState<ActivacionVentas2[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [inicio, setInicio] = useState(() => datetimeLocal(new Date()));
  const [fin, setFin] = useState(() => datetimeLocal(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [frecuencia, setFrecuencia] = useState("5");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sucursalesActivas = useMemo(() => sucursales.filter((s) => s.activo), [sucursales]);
  const totalRecaudado = useMemo(() => activaciones.reduce((sum, a) => sum + a.totalRecaudado, 0), [activaciones]);
  const pendientesRetiro = useMemo(
    () => activaciones.filter((a) => a.estado === "finalizada" && a.totalRecaudado > 0 && !a.retiradoEn).length,
    [activaciones]
  );

  async function cargar() {
    setLoading(true);
    const [resSucursales, resVentas2] = await Promise.all([fetch("/api/sucursales"), fetch("/api/ventas2")]);
    if (resSucursales.ok) setSucursales(await resSucursales.json());
    if (resVentas2.ok) {
      const data = await resVentas2.json();
      setActivaciones(data.activaciones ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar
    cargar();
  }, []);

  function toggleSucursal(id: string) {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function seleccionarTodas() {
    setSeleccionadas(new Set(sucursalesActivas.map((s) => s._id)));
  }

  async function activar() {
    setError(null);
    setSaving(true);
    const res = await fetch("/api/ventas2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sucursalIds: Array.from(seleccionadas),
        inicio: new Date(inicio).toISOString(),
        fin: new Date(fin).toISOString(),
        frecuencia: Number(frecuencia),
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo activar Notas de venta");
      return;
    }

    setSeleccionadas(new Set());
    await cargar();
  }

  async function accionar(id: string, accion: "terminar" | "retirar" | "cancelar") {
    setAccionando(`${id}:${accion}`);
    const res = await fetch(`/api/ventas2/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion }),
    });
    setAccionando(null);
    if (res.ok) await cargar();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-black/50">Total Notas de venta</p>
          <p className="mt-1 text-2xl font-bold text-titos-green-900">{formatMoney(totalRecaudado)}</p>
        </Card>
        <Card>
          <p className="text-sm text-black/50">Activaciones activas</p>
          <p className="mt-1 text-2xl font-bold text-titos-green-700">
            {activaciones.filter((a) => a.estado === "activa").length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-black/50">Pendientes de retirar</p>
          <p className="mt-1 text-2xl font-bold text-titos-orange-600">{pendientesRetiro}</p>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-titos-green-900">Activar protocolo</h2>
          <Button variant="ghost" onClick={seleccionarTodas} disabled={sucursalesActivas.length === 0}>
            Todas las sucursales
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-2 text-sm font-medium text-black/70">Sucursales</p>
            {sucursalesActivas.length === 0 ? (
              <EmptyState message="No hay sucursales activas disponibles." />
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {sucursalesActivas.map((sucursal) => (
                  <label
                    key={sucursal._id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-black/2"
                  >
                    <span>
                      <span className="font-medium text-titos-green-900">{sucursal.nombre}</span>
                      <span className="block text-xs text-black/40">{sucursal.whatsapp || "Sin WhatsApp"}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={seleccionadas.has(sucursal._id)}
                      onChange={() => toggleSucursal(sucursal._id)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <FormField label="Inicio">
              <Input icon={CalendarClock} type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </FormField>
            <FormField label="Fin">
              <Input icon={Clock} type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} />
            </FormField>
            <FormField label="Frecuencia">
              <Input
                icon={Banknote}
                type="number"
                min="2"
                step="1"
                value={frecuencia}
                onChange={(e) => setFrecuencia(e.target.value)}
                placeholder="Ej. 5"
              />
            </FormField>
            <p className="text-xs text-black/45">
              La regla aplica solo a ventas pagadas 100% en efectivo: 1 de cada {Number(frecuencia) || "X"} se registra en Notas de venta.
            </p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button onClick={activar} disabled={saving || seleccionadas.size === 0} className="w-full justify-center">
              {saving ? "Activando..." : "Activar Notas de venta"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-titos-green-900">Resumen por sucursal</h2>
          <Button variant="ghost" onClick={cargar} disabled={loading}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Actualizar
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-black/50">Cargando...</p>
        ) : activaciones.length === 0 ? (
          <EmptyState message="Todavia no hay activaciones de Notas de venta." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-black/50">
                  <th className="py-2 pr-3">Sucursal</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Lapso</th>
                  <th className="py-2 pr-3">Regla</th>
                  <th className="py-2 pr-3">Movs.</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Avisos</th>
                  <th className="py-2 pr-3">Retiro</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {activaciones.map((a) => (
                  <tr key={a.id} className="border-b border-black/5 align-top">
                    <td className="py-2 pr-3 font-medium text-titos-green-900">{a.sucursalNombre}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${estadoClase(a.estado)}`}>
                        {a.estado}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-black/60">
                      <span className="block">{formatoFecha(a.inicio)}</span>
                      <span className="block">{formatoFecha(a.fin)}</span>
                    </td>
                    <td className="py-2 pr-3">1 / {a.frecuencia}</td>
                    <td className="py-2 pr-3">{a.cantidadMovimientos}</td>
                    <td className="py-2 pr-3 font-semibold text-titos-green-900">{formatMoney(a.totalRecaudado)}</td>
                    <td className="py-2 pr-3 text-xs text-black/55">
                      <span className="flex items-center gap-1">
                        <MessageCircleWarning className="h-3.5 w-3.5" />
                        Inicio: {avisoLabel(a.notificacionInicio)}
                      </span>
                      <span className="mt-1 flex items-center gap-1">
                        <MessageCircleWarning className="h-3.5 w-3.5" />
                        Fin: {avisoLabel(a.notificacionFin)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-black/60">
                      {a.retiradoEn ? (
                        <span className="inline-flex items-center gap-1 text-titos-green-700">
                          <Check className="h-3.5 w-3.5" />
                          {formatoFecha(a.retiradoEn)}
                        </span>
                      ) : a.estado === "finalizada" && a.totalRecaudado > 0 ? (
                        <span className="text-amber-600">Pendiente</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        {a.estado === "activa" ? (
                          <Button
                            variant="ghost"
                            onClick={() => accionar(a.id, "terminar")}
                            disabled={accionando === `${a.id}:terminar`}
                          >
                            Terminar
                          </Button>
                        ) : null}
                        {a.estado === "programada" ? (
                          <Button
                            variant="danger"
                            onClick={() => accionar(a.id, "cancelar")}
                            disabled={accionando === `${a.id}:cancelar`}
                          >
                            Cancelar
                          </Button>
                        ) : null}
                        {a.estado === "finalizada" && a.totalRecaudado > 0 && !a.retiradoEn ? (
                          <Button
                            variant="secondary"
                            onClick={() => accionar(a.id, "retirar")}
                            disabled={accionando === `${a.id}:retirar`}
                          >
                            <SquareCheckBig className="mr-1 h-4 w-4" />
                            Retirado
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
