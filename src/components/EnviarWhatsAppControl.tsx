"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

type Destinatario = { id: string; label: string; whatsapp: string };
type Documento = { tipo: "pedido" | "orden-compra"; id: string };

export function EnviarWhatsAppControl({
  destinatarios,
  documento,
  caption,
}: {
  destinatarios: Destinatario[];
  documento: Documento;
  caption: string;
}) {
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const disponibles = destinatarios.filter((d) => d.whatsapp);

  function alternar(id: string) {
    setSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function enviar() {
    const elegidos = disponibles.filter((d) => seleccionados.includes(d.id));
    if (elegidos.length === 0) return;

    setEnviando(true);
    setResultado(null);

    // Se envía uno a la vez (no en paralelo): la instancia de WhatsApp sólo
    // mantiene una sesión y los envíos simultáneos pueden pisarse entre sí,
    // dejando destinatarios sin su mensaje aunque la petición responda 200.
    const exitosos: string[] = [];
    const fallidos: string[] = [];
    for (const destinatario of elegidos) {
      const res = await fetch("/api/whatsapp/enviar-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: documento.tipo,
          id: documento.id,
          whatsapp: destinatario.whatsapp,
          caption,
        }),
      });
      if (res.ok) exitosos.push(destinatario.label);
      else fallidos.push(destinatario.label);
    }

    setEnviando(false);

    const partes: string[] = [];
    if (exitosos.length > 0) partes.push(`Enviado a: ${exitosos.join(", ")}.`);
    if (fallidos.length > 0) partes.push(`No se pudo enviar a: ${fallidos.join(", ")}.`);

    setResultado({ ok: fallidos.length === 0, texto: partes.join(" ") });
  }

  if (disponibles.length === 0) {
    return <p className="text-xs text-black/40">Ningún destinatario tiene WhatsApp registrado todavía.</p>;
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-black/50">Enviar PDF por WhatsApp a...</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {disponibles.map((d) => (
          <label key={d.id} className="flex items-center gap-1.5 text-sm text-black/70">
            <input
              type="checkbox"
              checked={seleccionados.includes(d.id)}
              onChange={() => alternar(d.id)}
            />
            {d.label}
          </label>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        className="mt-2"
        disabled={seleccionados.length === 0 || enviando}
        onClick={enviar}
      >
        {enviando ? "Enviando..." : `Enviar${seleccionados.length > 0 ? ` (${seleccionados.length})` : ""}`}
      </Button>
      {resultado ? (
        <p className={`mt-2 text-xs ${resultado.ok ? "text-titos-green-700" : "text-red-600"}`}>{resultado.texto}</p>
      ) : null}
    </div>
  );
}
