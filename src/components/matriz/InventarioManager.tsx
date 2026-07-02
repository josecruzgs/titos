"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select, EmptyState, Pagination } from "@/components/ui";
import { ProductoCombobox } from "@/components/ProductoCombobox";
import { CATEGORIAS } from "@/lib/categorias";

const PAGE_SIZE = 20;

type Producto = {
  _id: string;
  sku: string;
  nombre: string;
  categoria: string;
  unidad: "pieza" | "kg";
  requierePesaje: boolean;
  existenciaMatriz: number;
};

export function InventarioManager() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [pesoKg, setPesoKg] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [page, setPage] = useState(1);

  async function cargar() {
    const res = await fetch("/api/productos");
    if (res.ok) setProductos(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar
    cargar();
  }, []);

  const productoSeleccionado = useMemo(
    () => productos.find((p) => p._id === productoId),
    [productos, productoId]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setSaving(true);

    const res = await fetch("/api/inventario/entrada", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productoId,
        cantidad: Number(cantidad),
        pesoKg: pesoKg ? Number(pesoKg) : undefined,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo registrar la entrada");
      return;
    }

    setMensaje("Entrada registrada e inventario actualizado.");
    setCantidad("");
    setPesoKg("");
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1 h-fit">
        <h2 className="mb-3 font-semibold text-titos-green-900">Registrar entrada de proveedor</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <ProductoCombobox productos={productos} value={productoId} onChange={setProductoId} />
          <Input
            type="number"
            min="1"
            placeholder={productoSeleccionado ? `Cantidad en ${productoSeleccionado.unidad}` : "Cantidad"}
            required
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
          {productoSeleccionado?.requierePesaje ? (
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Peso real en kg (báscula)"
              required
              value={pesoKg}
              onChange={(e) => setPesoKg(e.target.value)}
            />
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {mensaje ? <p className="text-sm text-titos-green-700">{mensaje}</p> : null}
          <Button type="submit" disabled={saving || !productoId} className="w-full justify-center">
            {saving ? "Guardando..." : "Registrar entrada"}
          </Button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-titos-green-900">Existencia actual en matriz ({productosFiltrados.length})</h2>
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
        {productosFiltrados.length === 0 ? (
          <EmptyState
            message={
              productos.length === 0
                ? "No hay productos en el catálogo todavía."
                : "Ningún producto coincide con la búsqueda o el filtro."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-black/50">
                    <th className="py-2 pr-2">Producto</th>
                    <th className="py-2 pr-2">Categoría</th>
                    <th className="py-2 pr-2">Existencia</th>
                    <th className="py-2 pr-2">Pesaje</th>
                  </tr>
                </thead>
                <tbody>
                  {productosPagina.map((p) => (
                    <tr key={p._id} className="border-b border-black/5">
                      <td className="py-2 pr-2 font-medium">{p.nombre}</td>
                      <td className="py-2 pr-2 capitalize text-black/60">{p.categoria.replaceAll("_", " ")}</td>
                      <td className="py-2 pr-2">
                        {p.existenciaMatriz} {p.unidad}
                      </td>
                      <td className="py-2 pr-2 text-black/50">{p.requierePesaje ? "Sí" : "—"}</td>
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
