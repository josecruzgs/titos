"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EstadoBadge, Button, formatMoney } from "@/components/ui";
import { ChevronDown, ChevronRight } from "lucide-react";

const ETIQUETAS_METODO: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

type VentaItem = { nombreProducto: string; cantidad: number; unidad: string; precioUnitario: number; subtotal: number };
type PagoVenta = { metodoPago: string; monto: number };
type Venta = {
  _id: string;
  folio: string;
  createdAt: string;
  items: VentaItem[];
  total: number;
  pagos: PagoVenta[];
  montoRecibido: number | null;
  cambio: number | null;
  estado: "completada" | "cancelada";
};

function resumenPagos(pagos: PagoVenta[] | null | undefined) {
  return (pagos ?? []).map((p) => ETIQUETAS_METODO[p.metodoPago] ?? p.metodoPago).join(" + ");
}

export function VentasHistorial({ ventas }: { ventas: Venta[] }) {
  const router = useRouter();
  const [expandido, setExpandido] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);

  async function cancelarVenta(id: string) {
    if (!confirm("¿Cancelar esta venta? El stock de los productos se devolverá al inventario.")) return;
    setCancelando(id);
    const res = await fetch(`/api/ventas/${id}/cancelar`, { method: "POST" });
    setCancelando(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="rounded-xl border border-black/5 bg-white shadow-sm">
      <ul className="divide-y divide-black/5">
        {ventas.map((v) => {
          const abierto = expandido === v._id;
          return (
            <li key={v._id}>
              <button
                type="button"
                onClick={() => setExpandido(abierto ? null : v._id)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm hover:bg-black/2"
              >
                <span className="flex items-center gap-2 font-medium">
                  {abierto ? <ChevronDown className="h-4 w-4 text-black/30" /> : <ChevronRight className="h-4 w-4 text-black/30" />}
                  {v.folio}
                </span>
                <span className="text-xs text-black/40">
                  {new Date(v.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <span className="text-black/50">{resumenPagos(v.pagos)}</span>
                <span className="font-semibold text-titos-green-900">{formatMoney(v.total)}</span>
                <EstadoBadge estado={v.estado} />
              </button>

              {abierto ? (
                <div className="px-5 pb-4">
                  <ul className="mb-3 divide-y divide-black/5 rounded-lg bg-black/2 px-3 text-sm">
                    {v.items.map((i, idx) => (
                      <li key={idx} className="flex items-center justify-between py-1.5">
                        <span>
                          {i.nombreProducto} × {i.cantidad} {i.unidad}
                        </span>
                        <span className="font-medium">{formatMoney(i.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <ul className="mb-3 space-y-1 text-sm text-black/60">
                    {(v.pagos ?? []).map((p, idx) => (
                      <li key={idx} className="flex items-center justify-between">
                        <span>{ETIQUETAS_METODO[p.metodoPago] ?? p.metodoPago}</span>
                        <span className="font-medium">{formatMoney(p.monto)}</span>
                      </li>
                    ))}
                    {(v.pagos ?? []).some((p) => p.metodoPago === "efectivo") ? (
                      <>
                        <li className="flex items-center justify-between">
                          <span>Efectivo recibido</span>
                          <span className="font-medium">{formatMoney(v.montoRecibido ?? 0)}</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Cambio</span>
                          <span className="font-medium">{formatMoney(v.cambio ?? 0)}</span>
                        </li>
                      </>
                    ) : null}
                  </ul>
                  {v.estado === "completada" ? (
                    <Button variant="danger" onClick={() => cancelarVenta(v._id)} disabled={cancelando === v._id}>
                      {cancelando === v._id ? "Cancelando..." : "Cancelar venta"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
