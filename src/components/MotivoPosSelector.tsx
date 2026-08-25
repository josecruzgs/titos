"use client";

import { useEffect, useState } from "react";
import { Input, Select } from "@/components/ui";
import { LARGO_MAXIMO_MOTIVO, type MotivoPos, type TipoMotivoPos } from "@/lib/motivosPos";

const OTRO = "__otro__";

/**
 * Elige el motivo de una cancelación o una devolución de la lista que configuró
 * matriz. Siempre deja la salida de "Otro" para capturarlo a mano: un mostrador
 * no se puede quedar atorado porque el caso no esté en el catálogo.
 *
 * El componente reporta hacia arriba el texto final del motivo, así que quien lo
 * usa sigue mandando al servidor el mismo string de siempre.
 */
export function MotivoPosSelector({
  tipo,
  value,
  onChange,
  disabled = false,
  autoFocus = false,
}: {
  tipo: TipoMotivoPos;
  value: string;
  onChange: (motivo: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [motivos, setMotivos] = useState<MotivoPos[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enOtro, setEnOtro] = useState(false);

  // `tipo` es fijo en cada punto donde se usa el selector, así que la carga
  // ocurre una sola vez por montaje.
  useEffect(() => {
    let vigente = true;

    fetch(`/api/motivos-pos?tipo=${tipo}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: MotivoPos[]) => {
        if (!vigente) return;
        setMotivos(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // Sin catálogo (o sin conexión) el campo sigue sirviendo como texto libre.
        if (vigente) setMotivos([]);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [tipo]);

  // Sin motivos configurados no hay nada que elegir: se captura a mano.
  const soloTextoLibre = !cargando && motivos.length === 0;
  const escribiendo = soloTextoLibre || enOtro;

  // El valor solo coincide con el select si es uno de los del catálogo; si el
  // usuario ya venía escribiendo texto libre, el select se queda en "Otro".
  const seleccion = motivos.some((m) => m.texto === value) && !enOtro ? value : enOtro ? OTRO : "";

  function elegir(opcion: string) {
    if (opcion === OTRO) {
      setEnOtro(true);
      onChange("");
      return;
    }
    setEnOtro(false);
    onChange(opcion);
  }

  return (
    <div className="space-y-2">
      {!soloTextoLibre ? (
        <Select value={seleccion} onChange={(e) => elegir(e.target.value)} disabled={disabled || cargando}>
          <option value="">{cargando ? "Cargando motivos..." : "Selecciona un motivo"}</option>
          {motivos.map((motivo) => (
            <option key={motivo._id} value={motivo.texto}>
              {motivo.texto}
            </option>
          ))}
          <option value={OTRO}>Otro (especificar)</option>
        </Select>
      ) : null}

      {escribiendo ? (
        <Input
          autoFocus={autoFocus || enOtro}
          maxLength={LARGO_MAXIMO_MOTIVO}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Describe el motivo"
        />
      ) : null}
    </div>
  );
}
