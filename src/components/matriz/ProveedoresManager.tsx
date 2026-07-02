"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, EmptyState } from "@/components/ui";

type Proveedor = {
  _id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
};

const emptyForm = { nombre: "", contacto: "", telefono: "", email: "" };

export function ProveedoresManager() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    const res = await fetch("/api/proveedores");
    if (res.ok) setProveedores(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar
    cargar();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/proveedores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo crear el proveedor");
      return;
    }

    setForm(emptyForm);
    cargar();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1 h-fit">
        <h2 className="mb-3 font-semibold text-titos-green-900">Nuevo proveedor</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="Nombre del proveedor"
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <Input
            placeholder="Persona de contacto"
            value={form.contacto}
            onChange={(e) => setForm({ ...form, contacto: e.target.value })}
          />
          <Input
            placeholder="Teléfono"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          />
          <Input
            type="email"
            placeholder="Correo"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={saving} className="w-full justify-center">
            {saving ? "Guardando..." : "Agregar proveedor"}
          </Button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <h2 className="mb-3 font-semibold text-titos-green-900">Proveedores ({proveedores.length})</h2>
        {loading ? (
          <p className="text-sm text-black/50">Cargando...</p>
        ) : proveedores.length === 0 ? (
          <EmptyState message="Todavía no hay proveedores registrados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-black/50">
                  <th className="py-2 pr-2">Nombre</th>
                  <th className="py-2 pr-2">Contacto</th>
                  <th className="py-2 pr-2">Teléfono</th>
                  <th className="py-2 pr-2">Correo</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((p) => (
                  <tr key={p._id} className="border-b border-black/5">
                    <td className="py-2 pr-2 font-medium">{p.nombre}</td>
                    <td className="py-2 pr-2 text-black/60">{p.contacto || "—"}</td>
                    <td className="py-2 pr-2 text-black/60">{p.telefono || "—"}</td>
                    <td className="py-2 pr-2 text-black/60">{p.email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
