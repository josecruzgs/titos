import EmisorValeModel from "@/models/EmisorVale";
import BinValeModel from "@/models/BinVale";

// Identificación de tarjetas de vales de despensa.
//
// El lector de banda se comporta como un teclado: al pasar la tarjeta escribe de
// golpe el contenido de la banda y un Enter. De ahí se extrae el número (PAN) y
// de sus primeros 6 dígitos (el BIN) se deduce el emisor.
//
// Nunca se guarda el número completo: solo el BIN y los últimos 4, que es lo
// que se necesita para clasificar el vale y para aclaraciones.

/** Emisores con los que se arranca. Sus BIN se aprenden al usarlos. */
export const EMISORES_SEMILLA = [
  "Sí Vale (Edenred)",
  "Pluxee (antes Sodexo)",
  "Broxel",
  "Toka",
  "Efectivale",
];

export const LONGITUD_BIN = 6;

/**
 * Saca el número de tarjeta de lo que escribió el lector.
 *
 * Cubre las dos salidas comunes: Track 2 (`;5555444433332222=2512...?`) y
 * Track 1 (`%B5555444433332222^APELLIDO/NOMBRE^...?`), y también el caso de
 * teclearlo a mano. Se toma la corrida de dígitos más larga de 12 a 19, que es
 * el rango de un PAN.
 */
export function extraerPan(entrada: string): string | null {
  if (!entrada) return null;

  // El PAN va antes del separador de campos de la banda.
  const antesDelSeparador = entrada.split(/[=^]/)[0] ?? entrada;
  const corridas = antesDelSeparador.match(/\d{12,19}/g);
  if (!corridas || corridas.length === 0) return null;

  return corridas.reduce((mayor, actual) => (actual.length > mayor.length ? actual : mayor));
}

export function binDe(pan: string) {
  return pan.slice(0, LONGITUD_BIN);
}

export function ultimos4De(pan: string) {
  return pan.slice(-4);
}

export type LecturaVale = {
  bin: string;
  ultimos4: string;
  emisorId: string | null;
  emisorNombre: string;
  /** false cuando el BIN es nuevo y hay que preguntarle al cajero de quién es. */
  reconocida: boolean;
};

/**
 * Identifica una tarjeta a partir de lo leído. Devuelve `reconocida: false`
 * cuando el BIN todavía no está asociado a ningún emisor: en ese caso el punto
 * de venta le pide al cajero que lo elija una sola vez.
 */
export async function identificarVale(entrada: string): Promise<LecturaVale | null> {
  const pan = extraerPan(entrada);
  if (!pan) return null;

  const bin = binDe(pan);
  const registro = await BinValeModel.findOne({ bin }).lean();

  if (registro?.emisorId) {
    return {
      bin,
      ultimos4: ultimos4De(pan),
      emisorId: String(registro.emisorId),
      emisorNombre: registro.emisorNombre ?? "",
      reconocida: true,
    };
  }

  // Un BIN visto pero todavía sin dueño también cuenta: se lleva el registro
  // para que matriz vea cuáles faltan por clasificar.
  return { bin, ultimos4: ultimos4De(pan), emisorId: null, emisorNombre: "", reconocida: false };
}

/** Deja constancia de que se vio este BIN (aunque todavía no se sepa de quién es). */
export async function registrarLectura(bin: string) {
  await BinValeModel.updateOne(
    { bin },
    { $inc: { veces: 1 }, $set: { ultimaVez: new Date() }, $setOnInsert: { bin, primeraVez: new Date() } },
    { upsert: true }
  );
}

/**
 * Enseña al sistema de quién es un BIN. A partir de aquí esa tarjeta (y todas
 * las del mismo emisor con ese prefijo) se identifican solas.
 */
export async function asignarBin(bin: string, emisorId: string, usuarioId?: string | null) {
  const emisor = await EmisorValeModel.findById(emisorId).select("nombre").lean();
  if (!emisor) return null;

  await BinValeModel.updateOne(
    { bin },
    {
      $set: {
        emisorId,
        emisorNombre: emisor.nombre,
        ultimaVez: new Date(),
        asignadoPorId: usuarioId ?? null,
      },
      $setOnInsert: { bin, primeraVez: new Date() },
    },
    { upsert: true }
  );

  // El prefijo también se guarda en el emisor, para poder verlos todos juntos.
  await EmisorValeModel.updateOne({ _id: emisorId }, { $addToSet: { prefijosBin: bin } });

  return { bin, emisorId, emisorNombre: emisor.nombre };
}

/** Crea los emisores de arranque una sola vez. */
export async function asegurarEmisoresSemilla() {
  await Promise.all(
    EMISORES_SEMILLA.map((nombre) =>
      EmisorValeModel.updateOne({ nombre }, { $setOnInsert: { nombre, activo: true } }, { upsert: true })
    )
  );
}
