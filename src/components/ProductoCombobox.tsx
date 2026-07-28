"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui";

type ProductoOpcion = {
  _id: string;
  sku: string;
  nombre: string;
  alias?: string[];
};

export function ProductoCombobox({
  productos,
  value,
  onChange,
  placeholder = "Buscar producto por nombre, SKU o alias...",
}: {
  productos: ProductoOpcion[];
  value: string;
  onChange: (productoId: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const seleccionado = useMemo(() => productos.find((p) => p._id === value) ?? null, [productos, value]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el texto visible cuando el valor cambia desde fuera del combobox
    setQuery(seleccionado ? `${seleccionado.nombre} (${seleccionado.sku})` : "");
  }, [seleccionado]);

  useEffect(() => {
    return () => {
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, []);

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const coincidencias = q
      ? productos.filter(
          (p) =>
            p.nombre.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.alias?.some((a) => a.toLowerCase().includes(q))
        )
      : productos;
    return coincidencias.slice(0, 8);
  }, [productos, query]);

  function handleChange(text: string) {
    setQuery(text);
    setOpen(true);
    if (value) onChange("");
  }

  function seleccionar(p: ProductoOpcion) {
    onChange(p._id);
    setQuery(`${p.nombre} (${p.sku})`);
    setOpen(false);
  }

  function handleFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setOpen(true);
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => setOpen(false), 150);
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open ? (
        resultados.length > 0 ? (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-black/10 bg-white shadow-lg">
            {resultados.map((p) => (
              <button
                type="button"
                key={p._id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  seleccionar(p);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-titos-green-100"
              >
                {p.nombre} <span className="text-black/40">({p.sku})</span>
              </button>
            ))}
          </div>
        ) : query.trim() ? (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-black/10 bg-white p-3 text-sm text-black/40 shadow-lg">
            Sin coincidencias
          </div>
        ) : null
      ) : null}
    </div>
  );
}
