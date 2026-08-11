"use client";

import { createContext, useContext } from "react";
import { ZONA_HORARIA_DEFAULT } from "@/lib/zonasHorarias";

// La zona horaria configurada desde matriz para la sucursal en la que se está
// trabajando. Los layouts la leen en el servidor y la inyectan aquí para que
// cualquier componente cliente formatee horas con la zona correcta y no con la
// del sistema operativo de la PC.
const ZonaHorariaContext = createContext<string>(ZONA_HORARIA_DEFAULT);

export function ZonaHorariaProvider({ zona, children }: { zona?: string | null; children: React.ReactNode }) {
  return <ZonaHorariaContext.Provider value={zona || ZONA_HORARIA_DEFAULT}>{children}</ZonaHorariaContext.Provider>;
}

export function useZonaHoraria() {
  return useContext(ZonaHorariaContext);
}
