"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, EmptyState } from "@/components/ui";

type Sucursal = {
  _id: string;
  nombre: string;
  direccion: string;
};

const emptyForm = {
  nombre: "",
  direccion: "",
  usuarioNombre: "",
  email: "",
  password: "",
};

export function SucursalesManager() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function cargar() {
    const res = await fetch("/api/sucursales");
    if (res.ok) setSucursales(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar
    cargar();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setSaving(true);

    const res = await fetch("/api/sucursales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo crear la sucursal");
      return;
    }

    setMensaje(`Sucursal creada. Usuario de acceso: ${form.email}`);
    setForm(emptyForm);
    cargar();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1 h-fit">
        <h2 className="mb-3 font-semibold text-titos-green-900">Nueva sucursal</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="Nombre de la sucursal"
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <Input
            placeholder="Dirección"
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
          />
          <hr className="border-black/10" />
          <p className="text-xs font-medium uppercase text-black/40">Usuario de acceso de la sucursal</p>
          <Input
            placeholder="Nombre del responsable"
            value={form.usuarioNombre}
            onChange={(e) => setForm({ ...form, usuarioNombre: e.target.value })}
          />
          <Input
            type="email"
            placeholder="Correo de acceso"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            type="password"
            placeholder="Contraseña"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {mensaje ? <p className="text-sm text-titos-green-700">{mensaje}</p> : null}
          <Button type="submit" disabled={saving} className="w-full justify-center">
            {saving ? "Guardando..." : "Crear sucursal"}
          </Button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <h2 className="mb-3 font-semibold text-titos-green-900">Sucursales ({sucursales.length})</h2>
        {sucursales.length === 0 ? (
          <EmptyState message="Todavía no hay sucursales registradas." />
        ) : (
          <ul className="divide-y divide-black/5">
            {sucursales.map((s) => (
              <li key={s._id} className="py-2 text-sm">
                <p className="font-medium">{s.nombre}</p>
                {s.direccion ? <p className="text-black/50">{s.direccion}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
