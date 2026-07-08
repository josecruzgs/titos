export type ItemPedidoParaMonto = {
  requierePesaje?: boolean;
  cantidadPedida: number;
  cantidadAsignada?: number | null;
  cantidadSurtida?: number | null;
  pesoSurtidoKg?: number | null;
  precioVenta?: number | null;
};

// Para productos de pesaje, lo que realmente se cobra es el peso pesado al
// surtir (pesoSurtidoKg), no la cantidad nominal capturada al pedir/nivelar.
export function montoLineaPedido(item: ItemPedidoParaMonto) {
  const cantidad =
    item.requierePesaje && item.pesoSurtidoKg != null
      ? item.pesoSurtidoKg
      : (item.cantidadSurtida ?? item.cantidadAsignada ?? item.cantidadPedida);
  return cantidad * (item.precioVenta ?? 0);
}
