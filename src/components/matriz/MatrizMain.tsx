"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function MatrizMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // El punto de venta del mostrador usa todo el ancho y alto disponibles; el
  // resto de matriz conserva el ancho normal
  const esPuntoVenta = pathname === "/matriz/mostrador";

  return (
    <main
      className={`min-w-0 flex-1 overflow-x-hidden px-4 sm:px-6 ${
        esPuntoVenta ? "flex flex-col py-4 lg:px-6" : "py-6 lg:px-10"
      }`}
    >
      <div className={`w-full ${esPuntoVenta ? "flex min-h-0 flex-1 flex-col" : "mx-auto max-w-6xl"}`}>{children}</div>
    </main>
  );
}
