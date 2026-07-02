"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Select } from "@/components/ui";

type Producto = {
  _id: string;
  sku: string;
  nombre: string;
  categoria: string;
  unidad: "pieza" | "kg";
};

type LineaPedido = { productoId: string; nombre: string; unidad: string; cantidad: string };

type SolicitudNueva = {
  nombreSugerido: string;
  descripcion: string;
  unidad: "pieza" | "kg";
  cantidadSugerida: string;
};

const emptySolicitud: SolicitudNueva = { nombreSugerido: "", descripcion: "", unidad: "pieza", cantidadSugerida: "" };

export function NuevoPedidoForm() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [lineas, setLineas] = useState<LineaPedido[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudNueva[]>([]);
  const [solicitudDraft, setSolicitudDraft] = useState<SolicitudNueva>(emptySolicitud);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then(setProductos);
  }, []);

  const resultados = useMemo(() => {
    if (!busqueda.trim()) return [];
    const q = busqueda.toLowerCase();
    return productos
      .filter((p) => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .filter((p) => !lineas.some((l) => l.productoId === p._id))
      .slice(0, 8);
  }, [productos, busqueda, lineas]);

  function agregarProducto(p: Producto) {
    setLineas((prev) => [...prev, { productoId: p._id, nombre: p.nombre, unidad: p.unidad, cantidad: "" }]);
    setBusqueda("");
  }

  function actualizarCantidad(productoId: string, cantidad: string) {
    setLineas((prev) => prev.map((l) => (l.productoId === productoId ? { ...l, cantidad } : l)));
  }

  function quitarLinea(productoId: string) {
    setLineas((prev) => prev.filter((l) => l.productoId !== productoId));
  }

  function agregarSolicitud() {
    if (!solicitudDraft.nombreSugerido || !solicitudDraft.cantidadSugerida) return;
    setSolicitudes((prev) => [...prev, solicitudDraft]);
    setSolicitudDraft(emptySolicitud);
  }

  function quitarSolicitud(idx: number) {
    setSolicitudes((prev) => prev.filter((_, i) => i !== idx));
  }

  async function enviarPedido() {
    setError(null);

    const items = lineas
      .filter((l) => Number(l.cantidad) > 0)
      .map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad) }));

    if (items.length === 0 && solicitudes.length === 0) {
      setError("Agrega al menos un producto con cantidad, o una solicitud de producto nuevo.");
      return;
    }

    setEnviando(true);
    const res = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        solicitudesNuevas: solicitudes.map((s) => ({ ...s, cantidadSugerida: Number(s.cantidadSugerida) })),
      }),
    });

    setEnviando(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo enviar el pedido");
      return;
    }

    router.push("/sucursal/pedidos");
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 font-semibold text-titos-green-900">Productos existentes en catálogo</h2>
        <div className="relative">
          <Input
            placeholder="Buscar producto por nombre o SKU..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {resultados.length > 0 ? (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-black/10 bg-white shadow-lg">
              {resultados.map((p) => (
                <button
                  key={p._id}
                  onClick={() => agregarProducto(p)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-titos-green-100"
                >
                  {p.nombre} <span className="text-black/40">({p.sku})</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          {lineas.length === 0 ? (
            <p className="text-sm text-black/40">Aún no has agregado productos.</p>
          ) : (
            lineas.map((l) => (
              <div key={l.productoId} className="flex items-center gap-2 rounded-lg border border-black/5 p-2">
                <span className="flex-1 text-sm font-medium">{l.nombre}</span>
                <Input
                  type="number"
                  min="0"
                  placeholder={`Cantidad (${l.unidad})`}
                  value={l.cantidad}
                  onChange={(e) => actualizarCantidad(l.productoId, e.target.value)}
                  className="w-32"
                />
                <button onClick={() => quitarLinea(l.productoId)} className="text-sm text-red-500">
                  Quitar
                </button>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-titos-green-900">¿No encontraste el producto?</h2>
        <p className="mb-3 text-sm text-black/50">
          Solicita un producto que no está en el catálogo. Matriz lo revisará y generará una orden de compra.
        </p>
        <div className="space-y-2">
          <Input
            placeholder="Nombre del producto"
            value={solicitudDraft.nombreSugerido}
            onChange={(e) => setSolicitudDraft({ ...solicitudDraft, nombreSugerido: e.target.value })}
          />
          <Input
            placeholder="Descripción (opcional)"
            value={solicitudDraft.descripcion}
            onChange={(e) => setSolicitudDraft({ ...solicitudDraft, descripcion: e.target.value })}
          />
          <div className="flex gap-2">
            <Select
              value={solicitudDraft.unidad}
              onChange={(e) => setSolicitudDraft({ ...solicitudDraft, unidad: e.target.value as "pieza" | "kg" })}
            >
              <option value="pieza">Pieza</option>
              <option value="kg">Kilogramo</option>
            </Select>
            <Input
              type="number"
              min="1"
              placeholder="Cantidad sugerida"
              value={solicitudDraft.cantidadSugerida}
              onChange={(e) => setSolicitudDraft({ ...solicitudDraft, cantidadSugerida: e.target.value })}
            />
          </div>
          <Button type="button" variant="ghost" onClick={agregarSolicitud}>
            + Agregar solicitud
          </Button>
        </div>

        {solicitudes.length > 0 ? (
          <div className="mt-4 space-y-2">
            {solicitudes.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-titos-orange-100 p-2 text-sm">
                <span>
                  {s.nombreSugerido} — {s.cantidadSugerida} {s.unidad}
                </span>
                <button onClick={() => quitarSolicitud(i)} className="text-red-500">
                  Quitar
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <div className="lg:col-span-2">
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        <Button onClick={enviarPedido} disabled={enviando} className="w-full justify-center sm:w-auto">
          {enviando ? "Enviando..." : "Enviar pedido a la matriz"}
        </Button>
      </div>
    </div>
  );
}
