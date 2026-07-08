"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Select, Modal, FormField, EmptyState } from "@/components/ui";
import { ProductoCombobox } from "@/components/ProductoCombobox";
import { categoriaLabel } from "@/lib/categorias";

type Producto = {
  _id: string;
  sku: string;
  nombre: string;
  categoria: string;
  unidad: "pieza" | "kg";
};

type LineaPedido = { productoId: string; nombre: string; categoria: string; unidad: string; cantidad: string };

type SolicitudNueva = {
  nombreSugerido: string;
  descripcion: string;
  unidad: "pieza" | "kg";
  cantidadSugerida: string;
};

const emptySolicitud: SolicitudNueva = { nombreSugerido: "", descripcion: "", unidad: "pieza", cantidadSugerida: "" };

function SolicitudProductoModal({
  onClose,
  onAgregar,
}: {
  onClose: () => void;
  onAgregar: (solicitud: SolicitudNueva) => void;
}) {
  const [draft, setDraft] = useState<SolicitudNueva>(emptySolicitud);

  function agregar() {
    if (!draft.nombreSugerido || !draft.cantidadSugerida) return;
    onAgregar(draft);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Solicitar producto nuevo">
      <p className="mb-4 text-sm text-black/50">
        Solicita un producto que no está en el catálogo. Matriz lo revisará y generará una orden de compra.
      </p>
      <div className="space-y-3.5">
        <FormField label="Nombre del producto">
          <Input
            autoFocus
            value={draft.nombreSugerido}
            onChange={(e) => setDraft({ ...draft, nombreSugerido: e.target.value })}
          />
        </FormField>
        <FormField label="Descripción (opcional)">
          <Input value={draft.descripcion} onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Unidad">
            <Select
              value={draft.unidad}
              onChange={(e) => setDraft({ ...draft, unidad: e.target.value as "pieza" | "kg" })}
            >
              <option value="pieza">Pieza</option>
              <option value="kg">Kilogramo</option>
            </Select>
          </FormField>
          <FormField label="Cantidad sugerida">
            <Input
              type="number"
              min="1"
              value={draft.cantidadSugerida}
              onChange={(e) => setDraft({ ...draft, cantidadSugerida: e.target.value })}
            />
          </FormField>
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" disabled={!draft.nombreSugerido || !draft.cantidadSugerida} onClick={agregar}>
          Agregar solicitud
        </Button>
      </div>
    </Modal>
  );
}

export function NuevoPedidoForm() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [lineas, setLineas] = useState<LineaPedido[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudNueva[]>([]);
  const [modalSolicitudAbierto, setModalSolicitudAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then(setProductos);
  }, []);

  const productosDisponibles = useMemo(
    () => productos.filter((p) => !lineas.some((l) => l.productoId === p._id)),
    [productos, lineas]
  );

  function agregarProducto(productoId: string) {
    const p = productos.find((x) => x._id === productoId);
    if (!p) return;
    setLineas((prev) => [
      ...prev,
      { productoId: p._id, nombre: p.nombre, categoria: p.categoria, unidad: p.unidad, cantidad: "" },
    ]);
    setProductoSeleccionado("");
  }

  function actualizarCantidad(productoId: string, cantidad: string) {
    setLineas((prev) => prev.map((l) => (l.productoId === productoId ? { ...l, cantidad } : l)));
  }

  function quitarLinea(productoId: string) {
    setLineas((prev) => prev.filter((l) => l.productoId !== productoId));
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
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 font-semibold text-titos-green-900">Agregar productos del catálogo</h2>
        <ProductoCombobox productos={productosDisponibles} value={productoSeleccionado} onChange={agregarProducto} />

        <div className="mt-4">
          {lineas.length === 0 ? (
            <EmptyState message="Aún no has agregado productos. Búscalos arriba para agregarlos a tu pedido." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-black/50">
                    <th className="py-2 pr-2">Producto</th>
                    <th className="py-2 pr-2">Categoría</th>
                    <th className="py-2 pr-2">Cantidad a pedir</th>
                    <th className="py-2 pr-2" />
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => (
                    <tr key={l.productoId} className="border-b border-black/5">
                      <td className="py-2 pr-2 font-medium">{l.nombre}</td>
                      <td className="py-2 pr-2 capitalize text-black/60">{categoriaLabel(l.categoria)}</td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={l.cantidad}
                            onChange={(e) => actualizarCantidad(l.productoId, e.target.value)}
                            className="w-24"
                          />
                          <span className="text-black/40">{l.unidad}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <button onClick={() => quitarLinea(l.productoId)} className="text-sm text-red-500">
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-black/10 bg-black/1.5 p-4">
        <div>
          <p className="text-sm font-medium text-black/70">¿No encontraste el producto?</p>
          <p className="text-xs text-black/40">Solicítalo y matriz lo revisará para darlo de alta.</p>
        </div>
        <Button type="button" variant="ghost" onClick={() => setModalSolicitudAbierto(true)}>
          + Solicitar producto nuevo
        </Button>
      </div>

      {solicitudes.length > 0 ? (
        <Card>
          <h2 className="mb-3 font-semibold text-titos-green-900">Solicitudes de producto nuevo</h2>
          <div className="space-y-2">
            {solicitudes.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-titos-orange-100 p-2 text-sm">
                <span>
                  {s.nombreSugerido} — {s.cantidadSugerida} {s.unidad}
                  {s.descripcion ? ` · ${s.descripcion}` : ""}
                </span>
                <button onClick={() => quitarSolicitud(i)} className="text-red-500">
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div>
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        <Button onClick={enviarPedido} disabled={enviando} className="w-full justify-center sm:w-auto">
          {enviando ? "Enviando..." : "Enviar pedido a la matriz"}
        </Button>
      </div>

      {modalSolicitudAbierto ? (
        <SolicitudProductoModal
          onClose={() => setModalSolicitudAbierto(false)}
          onAgregar={(s) => setSolicitudes((prev) => [...prev, s])}
        />
      ) : null}
    </div>
  );
}
