"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, EstadoBadge, EmptyState } from "@/components/ui";

type Item = {
  productoId: string;
  nombreProducto: string;
  unidad: "pieza" | "kg";
  requierePesaje: boolean;
  cantidadPedida: number;
  cantidadAsignada: number | null;
  cantidadSurtida: number | null;
  pesoSurtidoKg: number | null;
  cantidadRecibida: number | null;
  pesoRecibidoKg: number | null;
};

type Pedido = {
  _id: string;
  folio: string;
  estado: "pendiente" | "nivelado" | "surtido" | "recibido";
  corte: string;
  fecha: string;
  sucursalId: { _id: string; nombre: string } | string;
  items: Item[];
};

const TABS = [
  { value: "pendiente", label: "Pendientes" },
  { value: "nivelado", label: "Nivelados (listos para surtir)" },
  { value: "historial", label: "Historial" },
] as const;

function nombreSucursal(pedido: Pedido) {
  return typeof pedido.sucursalId === "string" ? pedido.sucursalId : pedido.sucursalId.nombre;
}

export function PedidosManager() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("pendiente");
  const [nivelando, setNivelando] = useState(false);
  const [resultadoNivelador, setResultadoNivelador] = useState<string | null>(null);
  const [surtidoState, setSurtidoState] = useState<Record<string, Record<string, { cantidad: string; peso: string }>>>({});
  const [errorPorPedido, setErrorPorPedido] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    const res = await fetch("/api/pedidos");
    if (res.ok) setPedidos(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar
    cargar();
  }, []);

  const visibles = useMemo(() => {
    if (tab === "historial") return pedidos.filter((p) => p.estado === "surtido" || p.estado === "recibido");
    return pedidos.filter((p) => p.estado === tab);
  }, [pedidos, tab]);

  async function ejecutarNivelador() {
    setNivelando(true);
    setResultadoNivelador(null);
    const res = await fetch("/api/pedidos/nivelar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setNivelando(false);

    if (!res.ok) {
      setResultadoNivelador(data.error || "No se pudo ejecutar el Nivelador");
      return;
    }

    const necesidades = data.necesidadesCompra?.length ?? 0;
    setResultadoNivelador(
      `Nivelador ejecutado sobre ${data.procesados} pedido(s).${
        necesidades > 0
          ? ` Se generaron ${necesidades} necesidad(es) de compra por faltante — revísalas en Órdenes de compra.`
          : " Toda la demanda quedó cubierta."
      }`
    );
    cargar();
  }

  function actualizarCampo(pedidoId: string, productoId: string, campo: "cantidad" | "peso", value: string) {
    setSurtidoState((prev) => ({
      ...prev,
      [pedidoId]: {
        ...prev[pedidoId],
        [productoId]: {
          cantidad: campo === "cantidad" ? value : (prev[pedidoId]?.[productoId]?.cantidad ?? ""),
          peso: campo === "peso" ? value : (prev[pedidoId]?.[productoId]?.peso ?? ""),
        },
      },
    }));
  }

  async function surtirPedido(pedido: Pedido) {
    setEnviando(pedido._id);
    setErrorPorPedido((prev) => ({ ...prev, [pedido._id]: "" }));

    const estadoLocal = surtidoState[pedido._id] ?? {};
    const items = pedido.items.map((item) => {
      const local = estadoLocal[item.productoId];
      const cantidad = local?.cantidad ? Number(local.cantidad) : item.cantidadAsignada ?? 0;
      const peso = local?.peso ? Number(local.peso) : undefined;
      return { productoId: item.productoId, cantidadSurtida: cantidad, pesoSurtidoKg: peso };
    });

    const res = await fetch(`/api/pedidos/${pedido._id}/surtir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

    setEnviando(null);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorPorPedido((prev) => ({ ...prev, [pedido._id]: data.error || "No se pudo surtir el pedido" }));
      return;
    }

    cargar();
  }

  return (
    <div>
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-titos-green-900">Nivelador</h2>
            <p className="text-sm text-black/50">
              Reparte de forma proporcional y justa la existencia disponible entre todas las sucursales que pidieron
              el mismo producto, cuando la demanda supera lo que hay en almacén.
            </p>
          </div>
          <Button onClick={ejecutarNivelador} disabled={nivelando}>
            {nivelando ? "Ejecutando..." : "Ejecutar Nivelador"}
          </Button>
        </div>
        {resultadoNivelador ? <p className="mt-3 text-sm text-titos-green-700">{resultadoNivelador}</p> : null}
      </Card>

      <div className="mb-4 flex gap-1 border-b border-black/10">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.value ? "border-titos-green-600 text-titos-green-700" : "border-transparent text-black/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-black/50">Cargando...</p>
      ) : visibles.length === 0 ? (
        <EmptyState message="No hay pedidos en esta vista." />
      ) : (
        <div className="space-y-4">
          {visibles.map((pedido) => (
            <Card key={pedido._id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{nombreSucursal(pedido)}</p>
                  <p className="text-xs text-black/40">
                    {pedido.folio} · corte {pedido.corte}
                  </p>
                </div>
                <EstadoBadge estado={pedido.estado} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-black/50">
                      <th className="py-1.5 pr-2">Producto</th>
                      <th className="py-1.5 pr-2">Pedido</th>
                      {pedido.estado !== "pendiente" ? <th className="py-1.5 pr-2">Nivelado</th> : null}
                      {tab === "nivelado" ? <th className="py-1.5 pr-2">Surtir cantidad</th> : null}
                      {tab === "nivelado" ? <th className="py-1.5 pr-2">Peso (kg)</th> : null}
                      {tab === "historial" ? <th className="py-1.5 pr-2">Surtido</th> : null}
                      {tab === "historial" && pedido.estado === "recibido" ? (
                        <th className="py-1.5 pr-2">Recibido</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {pedido.items.map((item) => (
                      <tr key={item.productoId} className="border-b border-black/5">
                        <td className="py-1.5 pr-2 font-medium">
                          {item.nombreProducto}
                          {item.requierePesaje ? <span className="ml-1 text-xs text-titos-orange-600">(pesaje)</span> : null}
                        </td>
                        <td className="py-1.5 pr-2">
                          {item.cantidadPedida} {item.unidad}
                        </td>
                        {pedido.estado !== "pendiente" ? (
                          <td className="py-1.5 pr-2">
                            {item.cantidadAsignada}
                            {item.cantidadAsignada !== item.cantidadPedida ? (
                              <span className="ml-1 text-xs text-amber-600">(nivelado)</span>
                            ) : null}
                          </td>
                        ) : null}
                        {tab === "nivelado" ? (
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              min="0"
                              placeholder={String(item.cantidadAsignada ?? 0)}
                              defaultValue={item.cantidadAsignada ?? 0}
                              onChange={(e) => actualizarCampo(pedido._id, item.productoId, "cantidad", e.target.value)}
                              className="w-20 rounded border border-black/10 px-1 py-0.5"
                            />
                          </td>
                        ) : null}
                        {tab === "nivelado" ? (
                          <td className="py-1.5 pr-2">
                            {item.requierePesaje ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="kg"
                                onChange={(e) => actualizarCampo(pedido._id, item.productoId, "peso", e.target.value)}
                                className="w-20 rounded border border-black/10 px-1 py-0.5"
                              />
                            ) : (
                              <span className="text-black/30">—</span>
                            )}
                          </td>
                        ) : null}
                        {tab === "historial" ? (
                          <td className="py-1.5 pr-2">
                            {item.cantidadSurtida}
                            {item.pesoSurtidoKg ? ` (${item.pesoSurtidoKg} kg)` : ""}
                          </td>
                        ) : null}
                        {tab === "historial" && pedido.estado === "recibido" ? (
                          <td className="py-1.5 pr-2">
                            {item.cantidadRecibida}
                            {item.pesoRecibidoKg ? ` (${item.pesoRecibidoKg} kg)` : ""}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {tab === "nivelado" ? (
                <div className="mt-3 flex items-center justify-between">
                  {errorPorPedido[pedido._id] ? (
                    <p className="text-sm text-red-600">{errorPorPedido[pedido._id]}</p>
                  ) : (
                    <span />
                  )}
                  <Button onClick={() => surtirPedido(pedido)} disabled={enviando === pedido._id} variant="secondary">
                    {enviando === pedido._id ? "Enviando..." : "Confirmar surtido"}
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
