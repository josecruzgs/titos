"use client";

import { useEffect, useState } from "react";
import { useZonaHoraria } from "@/components/ZonaHorariaProvider";
import { formatHora } from "@/lib/zonasHorarias";

/**
 * Hora actual en la zona horaria configurada para la sucursal, no en la del
 * sistema operativo de la PC. Arranca vacío y se llena al montar para que el
 * HTML del servidor y el del cliente coincidan.
 */
export function useHoraActual() {
  const zona = useZonaHoraria();
  const [ahora, setAhora] = useState<Date | null>(null);

  useEffect(() => {
    setAhora(new Date());
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return ahora ? formatHora(ahora, zona) : "";
}

export function RelojZona({ className = "" }: { className?: string }) {
  const hora = useHoraActual();
  // Sin hora todavía (primer render) se reserva el espacio para que la barra no salte.
  return <span className={className}>{hora || " "}</span>;
}
