import FolioSecuencia from "@/models/FolioSecuencia";

/**
 * Folios consecutivos de ventas: VTA-000001, VTA-000002, ...
 *
 * A diferencia de `generateFolio`, que arma un folio aleatorio irrepetible pero
 * ilegible, este lleva una cuenta real por prefijo. Es lo que el mostrador dicta
 * por teléfono y lo que el cliente ve en su ticket, así que tiene que ser corto.
 */
export const DIGITOS_FOLIO = 6;

/** Formatea un consecutivo con el ancho fijo del folio. */
export function formatearFolio(prefijo: string, consecutivo: number) {
  return `${prefijo}-${String(consecutivo).padStart(DIGITOS_FOLIO, "0")}`;
}

/**
 * Aparta el siguiente folio del prefijo. El `$inc` con upsert es atómico, así
 * que dos ventas simultáneas nunca se llevan el mismo número.
 *
 * Pasadas las 999,999 ventas el folio crece a 7 dígitos en vez de reiniciarse:
 * repetir un folio sería peor que perder el ancho fijo.
 */
export async function siguienteFolio(prefijo: string): Promise<string> {
  const clave = prefijo.toUpperCase();

  // Si dos procesos hacen el upsert a la vez, el índice único deja pasar solo a
  // uno y el otro recibe un duplicado; al reintentar el documento ya existe.
  for (let intento = 0; intento < 3; intento++) {
    try {
      const secuencia = await FolioSecuencia.findOneAndUpdate(
        { prefijo: clave },
        { $inc: { consecutivo: 1 } },
        { new: true, upsert: true }
      );
      return formatearFolio(clave, secuencia.consecutivo);
    } catch (err) {
      const codigo = (err as { code?: number }).code;
      if (codigo !== 11000 || intento === 2) throw err;
    }
  }

  throw new Error(`No se pudo apartar el folio de ${clave}`);
}
