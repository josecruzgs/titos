// Constantes compartidas entre el modelo Rol y el catálogo de permisos. Viven
// aparte para que el modelo no tenga que importar todo `lib/permisos`.
export const AMBITOS_ROL = ["matriz", "sucursal"] as const;
export type AmbitoRol = (typeof AMBITOS_ROL)[number];
