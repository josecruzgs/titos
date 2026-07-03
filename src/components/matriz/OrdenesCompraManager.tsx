"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, EstadoBadge, EmptyState, Input, Select, Modal, formatMoney } from "@/components/ui";
import { ProductoCombobox } from "@/components/ProductoCombobox";
import { EnviarWhatsAppControl } from "@/components/EnviarWhatsAppControl";
import { imprimirHTML } from "@/lib/print";
import { CATEGORIAS } from "@/lib/categorias";

type Necesidad = {
  _id: string;
  productoId: string;
  nombreProducto: string;
  cantidadRequerida: number;
  motivo: "faltante_pedido" | "producto_nuevo" | "manual";
};

type Proveedor = { _id: string; nombre: string; whatsapp?: string };

type Empleado = { _id: string; nombre: string; puesto: string; whatsapp: string };

type ProductoOpcion = { _id: string; sku: string; nombre: string; unidad: "pieza" | "kg"; precioCompra: number };

type OrdenItem = {
  productoId: string;
  nombreProducto: string;
  cantidadRequerida: number | null;
  cantidadOrdenada: number;
  precioUnitario: number;
  cantidadRecibida: number | null;
  necesidadId?: string | null;
};

type EstadoOrden = "borrador" | "solicitada" | "recibida" | "cancelada";

type Orden = {
  _id: string;
  folio: string;
  proveedorId: { _id: string; nombre: string; whatsapp?: string } | string;
  estado: EstadoOrden;
  items: OrdenItem[];
  createdAt: string;
  fechaSolicitud: string | null;
  fechaRecepcion: string | null;
  fechaCancelacion: string | null;
};

type Solicitud = {
  _id: string;
  nombreSugerido: string;
  descripcion: string;
  unidad: "pieza" | "kg";
  cantidadSugerida: number;
  estado: "pendiente" | "convertida";
  sucursalId: { nombre: string } | string;
};

const MOTIVO_LABEL: Record<string, string> = {
  faltante_pedido: "Faltante de pedido",
  producto_nuevo: "Producto nuevo",
  manual: "Agregado manual",
};

function nombreProveedor(orden: Orden) {
  return typeof orden.proveedorId === "string" ? orden.proveedorId : orden.proveedorId.nombre;
}

function whatsappProveedor(orden: Orden) {
  return typeof orden.proveedorId === "string" ? "" : (orden.proveedorId.whatsapp ?? "");
}

// Usa la cantidad recibida cuando ya se registró la recepción (puede ser
// menor o mayor a lo ordenado), para reflejar lo que realmente hay que pagar.
function montoLinea(item: OrdenItem) {
  const cantidad = item.cantidadRecibida ?? item.cantidadOrdenada;
  return cantidad * item.precioUnitario;
}

function totalOrden(orden: Orden) {
  return orden.items.reduce((sum, i) => sum + montoLinea(i), 0);
}

function fechaRelevante(orden: Orden) {
  const fecha = orden.fechaRecepcion ?? orden.fechaCancelacion ?? orden.fechaSolicitud ?? orden.createdAt;
  return new Date(fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

// Texto corto que acompaña al PDF adjunto por WhatsApp (el detalle completo
// va en el documento, no en el mensaje).
function resumenWhatsAppOrden(orden: Orden) {
  return [
    `*Orden de compra ${orden.folio}* — ${nombreProveedor(orden)}`,
    `Fecha: ${fechaRelevante(orden)} · Estado: ${orden.estado}`,
    `Total: ${formatMoney(totalOrden(orden))}`,
    "",
    "Se adjunta el detalle completo en PDF.",
  ].join("\n");
}

function htmlImprimibleOrden(orden: Orden) {
  const filas = orden.items
    .map(
      (i) => `
      <tr>
        <td>${i.nombreProducto}</td>
        <td>${i.cantidadOrdenada}</td>
        <td>${formatMoney(i.precioUnitario)}</td>
        <td>${formatMoney(montoLinea(i))}</td>
      </tr>`
    )
    .join("");

  return `
    <h1>Orden de compra ${orden.folio}</h1>
    <p class="subtitulo">${nombreProveedor(orden)} · estado ${orden.estado}</p>
    <table>
      <thead>
        <tr><th>Producto</th><th>Cantidad</th><th>Precio unit.</th><th>Subtotal</th></tr>
      </thead>
      <tbody>${filas}</tbody>
      <tfoot>
        <tr><td colspan="2"></td><td>Total</td><td>${formatMoney(totalOrden(orden))}</td></tr>
      </tfoot>
    </table>
  `;
}

function AgregarNecesidadForm({
  necesidad,
  proveedores,
  onAgregar,
}: {
  necesidad: Necesidad;
  proveedores: Proveedor[];
  onAgregar: (proveedorId: string, cantidad: number) => void;
}) {
  const [proveedorId, setProveedorId] = useState("");
  const [cantidad, setCantidad] = useState(String(necesidad.cantidadRequerida));

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-titos-green-100/40 p-3">
      <div className="min-w-40 flex-1">
        <label className="mb-1 block text-xs text-black/50">Proveedor</label>
        <Select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          <option value="">Selecciona...</option>
          {proveedores.map((p) => (
            <option key={p._id} value={p._id}>
              {p.nombre}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-28">
        <label className="mb-1 block text-xs text-black/50">Cantidad a pedir</label>
        <Input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={!proveedorId || Number(cantidad) <= 0}
        onClick={() => onAgregar(proveedorId, Number(cantidad))}
      >
        Agregar a la orden
      </Button>
    </div>
  );
}

function ConvertirForm({ solicitud, onConvertida }: { solicitud: Solicitud; onConvertida: () => void }) {
  const [sku, setSku] = useState("");
  const [categoria, setCategoria] = useState("abarrotes");
  const [requierePesaje, setRequierePesaje] = useState(solicitud.unidad === "kg");
  const [precioCompra, setPrecioCompra] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch(`/api/solicitudes-producto/${solicitud._id}/convertir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku,
        categoria,
        requierePesaje,
        precioCompra: Number(precioCompra) || 0,
        precioVenta: Number(precioVenta) || 0,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo convertir la solicitud");
      return;
    }

    onConvertida();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-2 rounded-lg bg-titos-green-100/40 p-3 sm:grid-cols-2">
      <Input placeholder="SKU nuevo" required value={sku} onChange={(e) => setSku(e.target.value)} />
      <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
        {CATEGORIAS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>
      <Input
        type="number"
        step="0.01"
        placeholder="Precio de compra"
        value={precioCompra}
        onChange={(e) => setPrecioCompra(e.target.value)}
      />
      <Input
        type="number"
        step="0.01"
        placeholder="Precio de venta"
        value={precioVenta}
        onChange={(e) => setPrecioVenta(e.target.value)}
      />
      <label className="col-span-full flex items-center gap-2 text-sm text-black/70">
        <input type="checkbox" checked={requierePesaje} onChange={(e) => setRequierePesaje(e.target.checked)} />
        Requiere pesaje (perecedero)
      </label>
      {error ? <p className="col-span-full text-sm text-red-600">{error}</p> : null}
      <div className="col-span-full">
        <Button type="submit" disabled={saving} variant="secondary">
          {saving ? "Creando..." : "Dar de alta producto y generar necesidad de compra"}
        </Button>
      </div>
    </form>
  );
}

function OrdenModal({
  orden,
  productos,
  empleados,
  onClose,
  onUpdated,
}: {
  orden: Orden;
  productos: ProductoOpcion[];
  empleados: Empleado[];
  onClose: () => void;
  onUpdated: (orden: Orden) => void;
}) {
  const [items, setItems] = useState<OrdenItem[]>(orden.items);
  const [nuevoProductoId, setNuevoProductoId] = useState("");
  const [nuevaCantidad, setNuevaCantidad] = useState("");
  const [recepcion, setRecepcion] = useState<Record<string, string>>(() =>
    Object.fromEntries(orden.items.map((i) => [i.productoId, String(i.cantidadOrdenada)]))
  );
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = orden.estado === "borrador";
  const total = items.reduce((sum, i) => sum + montoLinea(i), 0);

  function actualizarItem(productoId: string, campo: "cantidadOrdenada" | "precioUnitario", value: string) {
    setItems((prev) =>
      prev.map((i) => (i.productoId === productoId ? { ...i, [campo]: Number(value) || 0 } : i))
    );
  }

  function quitarItem(productoId: string) {
    setItems((prev) => prev.filter((i) => i.productoId !== productoId));
  }

  function agregarLinea() {
    const producto = productos.find((p) => p._id === nuevoProductoId);
    const cantidad = Number(nuevaCantidad);
    if (!producto || !cantidad || cantidad <= 0) return;
    if (items.some((i) => i.productoId === producto._id)) return;

    setItems((prev) => [
      ...prev,
      {
        productoId: producto._id,
        nombreProducto: producto.nombre,
        cantidadRequerida: null,
        cantidadOrdenada: cantidad,
        precioUnitario: producto.precioCompra ?? 0,
        cantidadRecibida: null,
      },
    ]);
    setNuevoProductoId("");
    setNuevaCantidad("");
  }

  async function guardarCambios() {
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/ordenes-compra/${orden._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudieron guardar los cambios");
      return false;
    }

    const actualizado = await res.json();
    onUpdated(actualizado);
    return true;
  }

  async function solicitar() {
    const guardado = await guardarCambios();
    if (!guardado) return;

    const res = await fetch(`/api/ordenes-compra/${orden._id}/solicitar`, { method: "POST" });
    if (res.ok) onUpdated(await res.json());
  }

  async function confirmarRecepcion() {
    const res = await fetch(`/api/ordenes-compra/${orden._id}/recibir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({
          productoId: i.productoId,
          cantidadRecibida: Number(recepcion[i.productoId]) || 0,
        })),
      }),
    });
    if (res.ok) onUpdated(await res.json());
  }

  async function cancelarOrden() {
    const res = await fetch(`/api/ordenes-compra/${orden._id}/cancelar`, { method: "POST" });
    if (res.ok) onUpdated(await res.json());
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${nombreProveedor(orden)} · ${orden.folio}`}
      footer={
        <>
          <Button variant="ghost" onClick={() => imprimirHTML(`Orden ${orden.folio}`, htmlImprimibleOrden(orden))}>
            Imprimir
          </Button>
          {editable ? (
            <>
              <Button variant="ghost" onClick={guardarCambios} disabled={saving || items.length === 0}>
                Guardar cambios
              </Button>
              <Button onClick={solicitar} disabled={saving || items.length === 0}>
                Solicitar al proveedor
              </Button>
            </>
          ) : null}
          {orden.estado === "solicitada" ? <Button onClick={confirmarRecepcion}>Confirmar recepción</Button> : null}
          {(orden.estado === "borrador" || orden.estado === "solicitada") && !confirmandoCancelar ? (
            <Button variant="danger" onClick={() => setConfirmandoCancelar(true)}>
              Cancelar orden
            </Button>
          ) : null}
          {confirmandoCancelar ? (
            <>
              <span className="self-center text-sm text-black/60">¿Seguro que quieres cancelar esta orden?</span>
              <Button variant="ghost" onClick={() => setConfirmandoCancelar(false)}>
                No
              </Button>
              <Button variant="danger" onClick={cancelarOrden}>
                Sí, cancelar
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <EstadoBadge estado={orden.estado} />
        <span className="text-xs text-black/40">{fechaRelevante(orden)}</span>
      </div>

      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-black/50">
              <th className="py-1.5 pr-2">Producto</th>
              <th className="py-1.5 pr-2">Cantidad</th>
              <th className="py-1.5 pr-2">Precio unit.</th>
              <th className="py-1.5 pr-2">Subtotal</th>
              {orden.estado === "solicitada" ? <th className="py-1.5 pr-2">Recibido</th> : null}
              {orden.estado === "recibida" ? <th className="py-1.5 pr-2">Recibido</th> : null}
              {editable ? <th className="py-1.5 pr-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.productoId} className="border-b border-black/5">
                <td className="py-1.5 pr-2 font-medium">{item.nombreProducto}</td>
                <td className="py-1.5 pr-2">
                  {editable ? (
                    <Input
                      type="number"
                      min="1"
                      value={item.cantidadOrdenada}
                      onChange={(e) => actualizarItem(item.productoId, "cantidadOrdenada", e.target.value)}
                      className="w-20"
                    />
                  ) : (
                    item.cantidadOrdenada
                  )}
                </td>
                <td className="py-1.5 pr-2">
                  {editable ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.precioUnitario}
                      onChange={(e) => actualizarItem(item.productoId, "precioUnitario", e.target.value)}
                      className="w-24"
                    />
                  ) : (
                    formatMoney(item.precioUnitario)
                  )}
                </td>
                <td className="py-1.5 pr-2">
                  {formatMoney(montoLinea(item))}
                  {item.cantidadRecibida !== null && item.cantidadRecibida !== item.cantidadOrdenada ? (
                    <span className="ml-1 text-xs text-amber-600">(ajustado)</span>
                  ) : null}
                </td>
                {orden.estado === "solicitada" ? (
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      min="0"
                      value={recepcion[item.productoId] ?? ""}
                      onChange={(e) => setRecepcion((prev) => ({ ...prev, [item.productoId]: e.target.value }))}
                      className="w-20"
                    />
                  </td>
                ) : null}
                {orden.estado === "recibida" ? (
                  <td className="py-1.5 pr-2">
                    {item.cantidadRecibida}
                    {item.cantidadRecibida !== item.cantidadOrdenada ? (
                      <span className="ml-1 text-xs text-amber-600">(ajustado)</span>
                    ) : null}
                  </td>
                ) : null}
                {editable ? (
                  <td className="py-1.5 pr-2">
                    <button onClick={() => quitarItem(item.productoId)} className="text-xs text-red-500">
                      Quitar
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} />
              <td className="pt-2 text-right text-xs font-semibold uppercase text-black/40">Total</td>
              <td className="pt-2 font-semibold text-titos-green-900">{formatMoney(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {editable ? (
        <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg bg-black/2 p-3">
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-xs text-black/50">Agregar otro producto</label>
            <ProductoCombobox productos={productos} value={nuevoProductoId} onChange={setNuevoProductoId} />
          </div>
          <div className="w-24">
            <label className="mb-1 block text-xs text-black/50">Cantidad</label>
            <Input type="number" min="1" value={nuevaCantidad} onChange={(e) => setNuevaCantidad(e.target.value)} />
          </div>
          <Button type="button" variant="ghost" onClick={agregarLinea} disabled={!nuevoProductoId || !nuevaCantidad}>
            Agregar línea
          </Button>
        </div>
      ) : null}

      <div className="mt-4 border-t border-black/5 pt-4">
        <EnviarWhatsAppControl
          documento={{ tipo: "orden-compra", id: orden._id }}
          caption={resumenWhatsAppOrden(orden)}
          destinatarios={[
            { id: "proveedor", label: `Proveedor: ${nombreProveedor(orden)}`, whatsapp: whatsappProveedor(orden) },
            ...empleados.map((e) => ({
              id: e._id,
              label: `${e.nombre}${e.puesto ? ` (${e.puesto})` : ""}`,
              whatsapp: e.whatsapp,
            })),
          ]}
        />
      </div>
    </Modal>
  );
}

const TABS = [
  { value: "por-ordenar", label: "Por ordenar" },
  { value: "ordenes", label: "Órdenes de compra" },
  { value: "solicitudes", label: "Solicitudes de producto nuevo" },
] as const;

export function OrdenesCompraManager() {
  const searchParams = useSearchParams();
  const tabInicial = TABS.find((t) => t.value === searchParams.get("tab"))?.value ?? "por-ordenar";

  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>(tabInicial);
  const [necesidades, setNecesidades] = useState<Necesidad[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<ProductoOpcion[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ordenModal, setOrdenModal] = useState<Orden | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [manualProductoId, setManualProductoId] = useState("");
  const [manualCantidad, setManualCantidad] = useState("");
  const [manualProveedorId, setManualProveedorId] = useState("");

  async function cargar() {
    setLoading(true);
    const [necRes, provRes, prodRes, ordRes, solRes, empRes] = await Promise.all([
      fetch("/api/necesidades-compra?estado=pendiente"),
      fetch("/api/proveedores"),
      fetch("/api/productos"),
      fetch("/api/ordenes-compra"),
      fetch("/api/solicitudes-producto"),
      fetch("/api/empleados"),
    ]);
    if (necRes.ok) setNecesidades(await necRes.json());
    if (provRes.ok) setProveedores(await provRes.json());
    if (prodRes.ok) setProductos(await prodRes.json());
    if (ordRes.ok) setOrdenes(await ordRes.json());
    if (solRes.ok) setSolicitudes(await solRes.json());
    if (empRes.ok) setEmpleados(await empRes.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar
    cargar();
  }, []);

  async function agregarProducto(payload: {
    proveedorId: string;
    productoId: string;
    nombreProducto: string;
    cantidadOrdenada: number;
    cantidadRequerida?: number;
    necesidadId?: string;
  }) {
    setError(null);
    const res = await fetch("/api/ordenes-compra", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo agregar el producto a la orden");
      return;
    }

    cargar();
  }

  function agregarManual() {
    const producto = productos.find((p) => p._id === manualProductoId);
    const cantidad = Number(manualCantidad);
    if (!producto || !manualProveedorId || !cantidad || cantidad <= 0) return;

    agregarProducto({
      proveedorId: manualProveedorId,
      productoId: producto._id,
      nombreProducto: producto.nombre,
      cantidadOrdenada: cantidad,
    });
    setManualProductoId("");
    setManualCantidad("");
    setManualProveedorId("");
  }

  const ordenesOrdenadas = useMemo(
    () => [...ordenes].sort((a, b) => (a.estado === "borrador" ? -1 : b.estado === "borrador" ? 1 : 0)),
    [ordenes]
  );

  const solicitudesPendientes = solicitudes.filter((s) => s.estado === "pendiente");

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-black/10">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.value ? "border-titos-green-600 text-titos-green-700" : "border-transparent text-black/50"
            }`}
          >
            {t.label}
            {t.value === "por-ordenar" && necesidades.length > 0 ? ` (${necesidades.length})` : ""}
            {t.value === "solicitudes" && solicitudesPendientes.length > 0 ? ` (${solicitudesPendientes.length})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-black/50">Cargando...</p>
      ) : tab === "por-ordenar" ? (
        <div className="space-y-6">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Card>
            <h2 className="mb-3 font-semibold text-titos-green-900">Necesidades pendientes ({necesidades.length})</h2>
            {necesidades.length === 0 ? (
              <EmptyState message="No hay necesidades de compra pendientes por asignar a un proveedor." />
            ) : (
              <div className="space-y-3">
                {necesidades.map((n) => (
                  <div key={n._id} className="rounded-lg border border-black/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{n.nombreProducto}</p>
                        <p className="text-xs text-black/40">
                          requiere {n.cantidadRequerida} · {MOTIVO_LABEL[n.motivo]}
                        </p>
                      </div>
                      <Button variant="ghost" onClick={() => setAbierta(abierta === n._id ? null : n._id)}>
                        {abierta === n._id ? "Cerrar" : "Agregar a orden"}
                      </Button>
                    </div>
                    {abierta === n._id ? (
                      <AgregarNecesidadForm
                        necesidad={n}
                        proveedores={proveedores}
                        onAgregar={(proveedorId, cantidad) => {
                          agregarProducto({
                            proveedorId,
                            productoId: n.productoId,
                            nombreProducto: n.nombreProducto,
                            cantidadOrdenada: cantidad,
                            cantidadRequerida: n.cantidadRequerida,
                            necesidadId: n._id,
                          });
                          setAbierta(null);
                        }}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-titos-green-900">Agregar producto manualmente</h2>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-56 flex-1">
                <label className="mb-1 block text-xs text-black/50">Producto</label>
                <ProductoCombobox productos={productos} value={manualProductoId} onChange={setManualProductoId} />
              </div>
              <div className="w-28">
                <label className="mb-1 block text-xs text-black/50">Cantidad</label>
                <Input type="number" min="1" value={manualCantidad} onChange={(e) => setManualCantidad(e.target.value)} />
              </div>
              <div className="min-w-40">
                <label className="mb-1 block text-xs text-black/50">Proveedor</label>
                <Select value={manualProveedorId} onChange={(e) => setManualProveedorId(e.target.value)}>
                  <option value="">Selecciona...</option>
                  {proveedores.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                variant="secondary"
                disabled={!manualProductoId || !manualProveedorId || !manualCantidad}
                onClick={agregarManual}
              >
                Agregar
              </Button>
            </div>
          </Card>
        </div>
      ) : tab === "ordenes" ? (
        ordenesOrdenadas.length === 0 ? (
          <EmptyState message="Todavía no se ha generado ninguna orden de compra." />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-black/50">
                    <th className="py-2 pr-2">Proveedor</th>
                    <th className="py-2 pr-2">Folio</th>
                    <th className="py-2 pr-2">Estado</th>
                    <th className="py-2 pr-2">Productos</th>
                    <th className="py-2 pr-2">Total</th>
                    <th className="py-2 pr-2">Fecha</th>
                    <th className="py-2 pr-2" />
                  </tr>
                </thead>
                <tbody>
                  {ordenesOrdenadas.map((o) => (
                    <tr key={o._id} className="border-b border-black/5">
                      <td className="py-2 pr-2 font-medium">{nombreProveedor(o)}</td>
                      <td className="py-2 pr-2 text-black/40">{o.folio}</td>
                      <td className="py-2 pr-2">
                        <EstadoBadge estado={o.estado} />
                      </td>
                      <td className="py-2 pr-2 text-black/60">{o.items.length}</td>
                      <td className="py-2 pr-2 font-medium text-titos-green-900">{formatMoney(totalOrden(o))}</td>
                      <td className="py-2 pr-2 text-black/40">{fechaRelevante(o)}</td>
                      <td className="py-2 pr-2">
                        <Button variant="ghost" onClick={() => setOrdenModal(o)}>
                          Ver / Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : solicitudes.length === 0 ? (
        <EmptyState message="No hay solicitudes de producto nuevo." />
      ) : (
        <div className="space-y-3">
          {solicitudes.map((s) => (
            <Card key={s._id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{s.nombreSugerido}</p>
                  <p className="text-xs text-black/40">
                    {typeof s.sucursalId === "string" ? s.sucursalId : s.sucursalId.nombre} · pide {s.cantidadSugerida}{" "}
                    {s.unidad}
                    {s.descripcion ? ` · ${s.descripcion}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <EstadoBadge estado={s.estado} />
                  {s.estado === "pendiente" ? (
                    <Button onClick={() => setAbierta(abierta === s._id ? null : s._id)} variant="ghost">
                      {abierta === s._id ? "Cerrar" : "Convertir"}
                    </Button>
                  ) : null}
                </div>
              </div>
              {abierta === s._id ? (
                <ConvertirForm
                  solicitud={s}
                  onConvertida={() => {
                    setAbierta(null);
                    cargar();
                  }}
                />
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {ordenModal ? (
        <OrdenModal
          orden={ordenModal}
          productos={productos}
          empleados={empleados}
          onClose={() => {
            setOrdenModal(null);
            cargar();
          }}
          onUpdated={(actualizado) => {
            setOrdenModal(actualizado);
            setOrdenes((prev) => prev.map((o) => (o._id === actualizado._id ? actualizado : o)));
          }}
        />
      ) : null}
    </div>
  );
}
