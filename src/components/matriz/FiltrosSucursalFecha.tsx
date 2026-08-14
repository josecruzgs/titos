"use client";

import { CalendarDays, Store } from "lucide-react";
import type { ReactNode } from "react";
import { Card, FormField, Input, Select } from "@/components/ui";

export type SucursalFiltro = { _id: string; nombre: string; esMatriz?: boolean };

/**
 * Filtro común de los reportes de matriz: sucursal + rango de fechas.
 * Las fechas se manejan como YYYY-MM-DD porque así se guarda el `corte` de las
 * ventas, ya calculado en la zona horaria de cada sucursal.
 */
export function FiltrosSucursalFecha({
  sucursales,
  sucursalId,
  onSucursalId,
  desde,
  onDesde,
  hasta,
  onHasta,
  children,
}: {
  sucursales: SucursalFiltro[];
  sucursalId: string;
  onSucursalId: (value: string) => void;
  desde: string;
  onDesde: (value: string) => void;
  hasta: string;
  onHasta: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <Card className="mb-6">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Sucursal">
          <Select icon={Store} value={sucursalId} onChange={(e) => onSucursalId(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s._id} value={s._id}>
                {s.nombre}
                {s.esMatriz ? " · matriz" : ""}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Desde">
          <Input icon={CalendarDays} type="date" value={desde} onChange={(e) => onDesde(e.target.value)} />
        </FormField>
        <FormField label="Hasta">
          <Input icon={CalendarDays} type="date" value={hasta} onChange={(e) => onHasta(e.target.value)} />
        </FormField>
        {children}
      </div>
    </Card>
  );
}

/** Fecha local en formato YYYY-MM-DD, con un desplazamiento opcional en días. */
export function fechaISO(diasAtras = 0) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - diasAtras);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}
