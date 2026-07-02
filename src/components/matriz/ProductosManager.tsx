"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select, EmptyState, Pagination } from "@/components/ui";
import { CATEGORIAS } from "@/lib/categorias";

const PAGE_SIZE = 20;

type Producto = {
  _id: string;
  sku: string;
  nombre: string;
  categoria: string;
  unidad: "pieza" | "kg";
  requierePesaje: boolean;
  precio: number;
  existenciaMatriz: number;
  stockMinimo: number;
  activo: boolean;
};

const emptyForm = {
  sku: "",
  nombre: "",
  categoria: "abarrotes",
  unidad: "pieza" as "pieza" | "kg",
  requierePesaje: false,
  precio: "",
  existenciaMatriz: "",
  stockMinimo: "",
};

export function ProductosManager() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [page, setPage] = useState(1);

  async function cargar() {
    setLoading(true);
    const res = await fetch("/api/productos");
    if (res.ok) setProductos(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar
    cargar();
  }, []);

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
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

    setForm(emptyForm);
    cargar();
  }

  async function toggleRequierePesaje(producto: Producto) {
    await fetch(`/api/productos/${producto._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requierePesaje: !producto.requierePesaje }),
    });
    cargar();
  }

  async function actualizarStockMinimo(producto: Producto, value: string) {
    await fetch(`/api/productos/${producto._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockMinimo: Number(value) || 0 }),
    });
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1 h-fit">
        <h2 className="mb-3 font-semibold text-titos-green-900">Nuevo producto</h2>
        <form onSubmit={handleCrear} className="space-y-3">
          <Input
            placeholder="SKU"
            required
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
          <Input
            placeholder="Nombre"
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <Select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select
            value={form.unidad}
            onChange={(e) => setForm({ ...form, unidad: e.target.value as "pieza" | "kg" })}
          >
            <option value="pieza">Pieza</option>
            <option value="kg">Kilogramo</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-black/70">
            <input
              type="checkbox"
              checked={form.requierePesaje}
              onChange={(e) => setForm({ ...form, requierePesaje: e.target.checked })}
            />
            Requiere pesaje (perecedero)
          </label>
          <Input
            type="number"
            step="0.01"
            placeholder="Precio"
            value={form.precio}
            onChange={(e) => setForm({ ...form, precio: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Existencia inicial"
            value={form.existenciaMatriz}
            onChange={(e) => setForm({ ...form, existenciaMatriz: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Stock mínimo (alerta)"
            value={form.stockMinimo}
            onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={saving} className="w-full justify-center">
            {saving ? "Guardando..." : "Agregar producto"}
          </Button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-titos-green-900">Catálogo ({productosFiltrados.length})</h2>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Buscar por nombre o SKU..."
              value={busqueda}
              onChange={(e) => actualizarBusqueda(e.target.value)}
              className="w-56"
            />
            <Select
              value={categoriaFiltro}
              onChange={(e) => actualizarCategoriaFiltro(e.target.value)}
              className="w-44"
            >
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
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
                    <th className="py-2 pr-2">SKU</th>
                    <th className="py-2 pr-2">Nombre</th>
                    <th className="py-2 pr-2">Categoría</th>
                    <th className="py-2 pr-2">Existencia</th>
                    <th className="py-2 pr-2">Pesaje</th>
                    <th className="py-2 pr-2">Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {productosPagina.map((p) => (
                    <tr key={p._id} className="border-b border-black/5">
                      <td className="py-2 pr-2 text-black/50">{p.sku}</td>
                      <td className="py-2 pr-2 font-medium">{p.nombre}</td>
                      <td className="py-2 pr-2 capitalize text-black/60">{p.categoria.replaceAll("_", " ")}</td>
                      <td className="py-2 pr-2">
                        {p.existenciaMatriz} {p.unidad}
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={p.requierePesaje}
                          onChange={() => toggleRequierePesaje(p)}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          defaultValue={p.stockMinimo}
                          onBlur={(e) => actualizarStockMinimo(p, e.target.value)}
                          className="w-16 rounded border border-black/10 px-1 py-0.5"
                        />
                      </td>
                    </tr>
                  ))}
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
    </div>
  );
}
