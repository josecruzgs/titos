"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";

export function AjustesSucursalForm({
  sucursalId,
  direccionInicial,
  whatsappInicial,
}: {
  sucursalId: string;
  direccionInicial: string;
  whatsappInicial: string;
}) {
  const router = useRouter();
  const [direccion, setDireccion] = useState(direccionInicial);
  const [whatsapp, setWhatsapp] = useState(whatsappInicial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setSaving(true);

    const res = await fetch(`/api/sucursales/${sucursalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direccion, whatsapp }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudieron guardar los cambios");
      return;
    }

    setMensaje("Datos actualizados.");
    router.refresh();
  }

  return (
    <Card className="max-w-md">
      <h2 className="mb-3 font-semibold text-titos-green-900">Datos de contacto de la sucursal</h2>
      <p className="mb-4 text-sm text-black/50">
        La matriz usa este número de WhatsApp para enviarte tus pedidos surtidos.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-black/70">Dirección</label>
          <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-black/70">WhatsApp</label>
          <Input
            placeholder="Con código de país, ej. 521XXXXXXXXXX"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {mensaje ? <p className="text-sm text-titos-green-700">{mensaje}</p> : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </form>
    </Card>
  );
}
