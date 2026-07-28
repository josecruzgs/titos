// Las categorías ahora son un catálogo dinámico (ver CategoriaProducto / /api/categorias).
// Este helper solo da formato de respaldo a valores antiguos tipo snake_case.
export function categoriaLabel(value: string) {
  return value.replaceAll("_", " ");
}
