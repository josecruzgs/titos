export const CATEGORIAS = [
  { value: "abarrotes", label: "Abarrotes" },
  { value: "frutas_verduras", label: "Frutas y verduras" },
  { value: "carniceria", label: "Carnicería" },
  { value: "lacteos", label: "Lácteos" },
  { value: "limpieza", label: "Limpieza" },
  { value: "panaderia", label: "Panadería" },
  { value: "bebidas", label: "Bebidas" },
] as const;

export const CATEGORIA_VALUES = CATEGORIAS.map((c) => c.value);

export function categoriaLabel(value: string) {
  return CATEGORIAS.find((c) => c.value === value)?.label ?? value.replaceAll("_", " ");
}
