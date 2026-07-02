export type DemandaSucursal = {
  sucursalId: string;
  cantidad: number;
};

export type AsignacionSucursal = {
  sucursalId: string;
  cantidadAsignada: number;
};

/**
 * Reparte una existencia limitada entre varias sucursales que la solicitan.
 *
 * Si la existencia alcanza para cubrir toda la demanda, cada sucursal recibe
 * exactamente lo que pidió. Si no alcanza, se usa el método de residuo mayor
 * (Hamilton): cada sucursal recibe una cuota proporcional a su demanda,
 * redondeada hacia abajo, y las unidades sobrantes (por el redondeo) se
 * reparten una por una empezando por las sucursales cuya cuota exacta tenía
 * la mayor parte fraccionaria. Esto garantiza que se use el 100% de la
 * existencia disponible y que el reparto sea proporcional y justo.
 */
export function nivelar(existencia: number, demandas: DemandaSucursal[]): AsignacionSucursal[] {
  const totalDemanda = demandas.reduce((sum, d) => sum + d.cantidad, 0);

  if (existencia <= 0 || totalDemanda === 0) {
    return demandas.map((d) => ({ sucursalId: d.sucursalId, cantidadAsignada: 0 }));
  }

  if (totalDemanda <= existencia) {
    return demandas.map((d) => ({ sucursalId: d.sucursalId, cantidadAsignada: d.cantidad }));
  }

  const cuotas = demandas.map((d) => {
    const cuotaExacta = (existencia * d.cantidad) / totalDemanda;
    return {
      sucursalId: d.sucursalId,
      demanda: d.cantidad,
      base: Math.floor(cuotaExacta),
      resto: cuotaExacta - Math.floor(cuotaExacta),
    };
  });

  const unidadesRepartidas = cuotas.reduce((sum, c) => sum + c.base, 0);
  let unidadesRestantes = existencia - unidadesRepartidas;

  const orden = [...cuotas].sort((a, b) => {
    if (b.resto !== a.resto) return b.resto - a.resto;
    if (b.demanda !== a.demanda) return b.demanda - a.demanda;
    return a.sucursalId.localeCompare(b.sucursalId);
  });

  const asignaciones = new Map(cuotas.map((c) => [c.sucursalId, c.base]));

  for (let i = 0; i < orden.length && unidadesRestantes > 0; i++) {
    const sucursalId = orden[i].sucursalId;
    asignaciones.set(sucursalId, (asignaciones.get(sucursalId) ?? 0) + 1);
    unidadesRestantes--;
  }

  return demandas.map((d) => ({
    sucursalId: d.sucursalId,
    cantidadAsignada: asignaciones.get(d.sucursalId) ?? 0,
  }));
}
