"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select, EmptyState, Pagination, Modal, FormGrid, FormField } from "@/components/ui";
import { Package, Barcode, Tag, Tags, Scale, DollarSign, Boxes, AlertTriangle, ArrowUpToLine } from "lucide-react";
import { ProductoProveedoresModal } from "@/components/matriz/ProductoProveedoresModal";

const PAGE_SIZE = 20;

type Producto = {
  _id: string;
  sku: string;
  nombre: string;
  linea: string;
  categoria: string;
  unidad: "pieza" | "kg";
  requierePesaje: boolean;
  precioCompra: number;
  precioVenta: number;
  existenciaMatriz: number;
  stockMinimo: number;
  stockMaximo: number;
  activo: boolean;
};

type Linea = { _id: string; nombre: string };
type Categoria = { _id: string; nombre: string };

const emptyForm = {
  sku: "",
  nombre: "",
  linea: "",
  categoria: "",
  unidad: "pieza" as "pieza" | "kg",
  requierePesaje: false,
  precioCompra: "",
  precioVenta: "",
  existenciaMatriz: "",
  stockMinimo: "",
  stockMaximo: "",
};

function CrearProductoModal({
  lineas,
  categorias,
  onClose,
  onCreado,
}: {
  lineas: Linea[];
  categorias: Categoria[];
  onClose: () => void;
  onCreado: () => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    setError(null);
    setSaving(true);

    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo crear el producto");
      return;
    }

    onCreado();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo producto"
      icon={Package}
      size="lg"
      footer={
        <Button onClick={crear} disabled={saving || !form.sku || !form.nombre || !form.categoria}>
          {saving ? "Guardando..." : "Agregar producto"}
        </Button>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <FormField label="SKU">
            <Input icon={Barcode} required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </FormField>
          <FormField label="Nombre">
            <Input icon={Package} required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </FormField>
          <FormField label="Línea (marca)">
            <Select icon={Tags} value={form.linea} onChange={(e) => setForm({ ...form, linea: e.target.value })}>
              <option value="">Sin línea</option>
              {lineas.map((l) => (
                <option key={l._id} value={l.nombre}>
                  {l.nombre}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Categoría">
            <Select icon={Tag} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              <option value="">Selecciona una categoría</option>
              {categorias.map((c) => (
                <option key={c._id} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Unidad">
            <Select icon={Scale} value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value as "pieza" | "kg" })}>
              <option value="pieza">Pieza</option>
              <option value="kg">Kilogramo</option>
            </Select>
          </FormField>
          <FormField label="Precio de compra (a proveedor)">
            <Input icon={DollarSign} type="number" step="0.01" value={form.precioCompra} onChange={(e) => setForm({ ...form, precioCompra: e.target.value })} />
          </FormField>
          <FormField label="Precio de venta (a sucursales)">
            <Input icon={DollarSign} type="number" step="0.01" value={form.precioVenta} onChange={(e) => setForm({ ...form, precioVenta: e.target.value })} />
          </FormField>
          <FormField label="Existencia inicial">
            <Input icon={Boxes} type="number" value={form.existenciaMatriz} onChange={(e) => setForm({ ...form, existenciaMatriz: e.target.value })} />
          </FormField>
          <FormField label="Stock mínimo (alerta)">
            <Input icon={AlertTriangle} type="number" value={form.stockMinimo} onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })} />
          </FormField>
          <FormField label="Stock máximo">
            <Input icon={ArrowUpToLine} type="number" value={form.stockMaximo} onChange={(e) => setForm({ ...form, stockMaximo: e.target.value })} />
          </FormField>
        </FormGrid>
        <label className="flex items-center gap-2 text-sm text-black/70">
          <input
            type="checkbox"
            checked={form.requierePesaje}
            onChange={(e) => setForm({ ...form, requierePesaje: e.target.checked })}
          />
          Requiere pesaje (perecedero)
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </Modal>
  );
}

export function ProductosManager() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [page, setPage] = useState(1);
  const [creando, setCreando] = useState(false);
  const [proveedoresModal, setProveedoresModal] = useState<Producto | null>(null);

  async function cargar() {
    setLoading(true);
    const res = await fetch("/api/productos");
    if (res.ok) setProductos(await res.json());
    setLoading(false);
  }

  async function cargarLineas() {
    const res = await fetch("/api/lineas");
    if (res.ok) setLineas(await res.json());
  }

  async function cargarCategorias() {
    const res = await fetch("/api/categorias");
    if (res.ok) setCategorias(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar
    cargar();
    cargarLineas();
    cargarCategorias();
  }, []);

  async function toggleRequierePesaje(producto: Producto) {
    await fetch(`/api/productos/${producto._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requierePesaje: !producto.requierePesaje }),
    });
    cargar();
  }

  async function actualizarCampoNumerico(
    producto: Producto,
    campo: "existenciaMatriz" | "stockMinimo" | "stockMaximo" | "precioCompra" | "precioVenta",
    value: string
  ) {
    await fetch(`/api/productos/${producto._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [campo]: Number(value) || 0 }),
    });
    cargar();
  }

  async function actualizarCampoTexto(producto: Producto, campo: "linea" | "categoria", value: string) {
    await fetch(`/api/productos/${producto._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [campo]: value }),
    });
    cargar();
  }

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      const coincideNombre = !q || p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const coincideCategoria = !categoriaFiltro || p.categoria === categoriaFiltro;
      return coincideNombre && coincideCategoria;
    });
  }, [productos, busqueda, categoriaFiltro]);

  const totalPages = Math.max(1, Math.ceil(productosFiltrados.length / PAGE_SIZE));
  const paginaActual = Math.min(page, totalPages);
  const productosPagina = productosFiltrados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);

  function actualizarBusqueda(value: string) {
    setBusqueda(value);
    setPage(1);
  }

  function actualizarCategoriaFiltro(value: string) {
    setCategoriaFiltro(value);
    setPage(1);
  }

  return (
    <div>
      <Card>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-titos-green-900">Catálogo ({productosFiltrados.length})</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-56">
              <Input
                placeholder="Buscar por nombre o SKU..."
                value={busqueda}
                onChange={(e) => actualizarBusqueda(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-44">
              <Select value={categoriaFiltro} onChange={(e) => actualizarCategoriaFiltro(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c._id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <Button className="shrink-0" onClick={() => setCreando(true)}>
              + Nuevo producto
            </Button>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-black/50">Cargando...</p>
        ) : productosFiltrados.length === 0 ? (
          <EmptyState
            message={
              productos.length === 0
                ? "Todavía no hay productos en el catálogo."
                : "Ningún producto coincide con la búsqueda o el filtro."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-black/50">
                    <th className="py-2 pr-2">Línea</th>
                    <th className="py-2 pr-2">Tipo de producto</th>
                    <th className="py-2 pr-2">Código</th>
                    <th className="py-2 pr-2">Producto</th>
                    <th className="py-2 pr-2">Unidad medida</th>
                    <th className="py-2 pr-2">Stock</th>
                    <th className="py-2 pr-2">Mínimo</th>
                    <th className="py-2 pr-2">Máximo</th>
                    <th className="py-2 pr-2">Diferencia</th>
                    <th className="py-2 pr-2">Costo</th>
                    <th className="py-2 pr-2">Público</th>
                    <th className="py-2 pr-2">Total costo</th>
                    <th className="py-2 pr-2">Total público</th>
                    <th className="py-2 pr-2">Pesaje</th>
                    <th className="py-2 pr-2" />
                  </tr>
                </thead>
                <tbody>
                  {productosPagina.map((p) => {
                    const diferencia = p.stockMaximo - p.existenciaMatriz;
                    const totalCosto = p.existenciaMatriz * p.precioCompra;
                    const totalPublico = p.existenciaMatriz * p.precioVenta;
                    return (
                      <tr key={p._id} className="border-b border-black/5">
                        <td className="py-2 pr-2">
                          <select
                            defaultValue={p.linea}
                            onChange={(e) => actualizarCampoTexto(p, "linea", e.target.value)}
                            className="w-28 rounded border border-black/10 px-1 py-0.5"
                          >
                            <option value="">Sin línea</option>
                            {lineas.map((l) => (
                              <option key={l._id} value={l.nombre}>
                                {l.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            defaultValue={p.categoria}
                            onChange={(e) => actualizarCampoTexto(p, "categoria", e.target.value)}
                            className="w-28 rounded border border-black/10 px-1 py-0.5"
                          >
                            {categorias.map((c) => (
                              <option key={c._id} value={c.nombre}>
                                {c.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2 text-black/50">{p.sku}</td>
                        <td className="py-2 pr-2 font-medium">{p.nombre}</td>
                        <td className="py-2 pr-2 text-black/60">{p.unidad}</td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            defaultValue={p.existenciaMatriz}
                            onBlur={(e) => actualizarCampoNumerico(p, "existenciaMatriz", e.target.value)}
                            className="w-16 rounded border border-black/10 px-1 py-0.5"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            defaultValue={p.stockMinimo}
                            onBlur={(e) => actualizarCampoNumerico(p, "stockMinimo", e.target.value)}
                            className="w-16 rounded border border-black/10 px-1 py-0.5"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            defaultValue={p.stockMaximo}
                            onBlur={(e) => actualizarCampoNumerico(p, "stockMaximo", e.target.value)}
                            className="w-16 rounded border border-black/10 px-1 py-0.5"
                          />
                        </td>
                        <td className={`py-2 pr-2 ${diferencia < 0 ? "text-red-600" : "text-black/60"}`}>{diferencia}</td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={p.precioCompra}
                            onBlur={(e) => actualizarCampoNumerico(p, "precioCompra", e.target.value)}
                            className="w-20 rounded border border-black/10 px-1 py-0.5"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={p.precioVenta}
                            onBlur={(e) => actualizarCampoNumerico(p, "precioVenta", e.target.value)}
                            className="w-20 rounded border border-black/10 px-1 py-0.5"
                          />
                        </td>
                        <td className="py-2 pr-2 text-black/60">${totalCosto.toFixed(2)}</td>
                        <td className="py-2 pr-2 text-black/60">${totalPublico.toFixed(2)}</td>
                        <td className="py-2 pr-2">
                          <input type="checkbox" checked={p.requierePesaje} onChange={() => toggleRequierePesaje(p)} />
                        </td>
                        <td className="py-2 pr-2">
                          <Button variant="ghost" onClick={() => setProveedoresModal(p)}>
                            Proveedores
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={paginaActual}
              totalPages={totalPages}
              totalItems={productosFiltrados.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      {creando ? (
        <CrearProductoModal
          lineas={lineas}
          categorias={categorias}
          onClose={() => setCreando(false)}
          onCreado={() => {
            setCreando(false);
            cargar();
          }}
        />
      ) : null}

      {proveedoresModal ? (
        <ProductoProveedoresModal
          productoId={proveedoresModal._id}
          productoNombre={proveedoresModal.nombre}
          onClose={() => setProveedoresModal(null)}
        />
      ) : null}
    </div>
  );
}
