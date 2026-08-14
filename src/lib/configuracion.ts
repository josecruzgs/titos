import Configuracion from "@/models/Configuracion";
import { verifyPassword } from "@/lib/auth";

/** La configuración es un documento único; se crea sola la primera vez. */
export async function obtenerConfiguracion() {
  let config = await Configuracion.findOne();
  if (!config) config = await Configuracion.create({});
  return config;
}

export const NIP_SUPERVISOR_REGEX = /^\d{4,8}$/;

export type ResultadoNip =
  | { ok: true; autorizadoConNip: boolean }
  | { ok: false; error: string };

/**
 * Valida el NIP con el que un supervisor autoriza una cancelación.
 *
 * Si todavía no se configura ningún NIP, la cancelación procede igual (para no
 * dejar el mostrador sin poder operar) pero queda marcada como no autorizada,
 * que es lo que después se ve en la bitácora.
 */
export async function verificarNipSupervisor(nip: string): Promise<ResultadoNip> {
  const config = await obtenerConfiguracion();
  const hash = config.nipSupervisorHash ?? "";

  if (!hash) return { ok: true, autorizadoConNip: false };
  if (!nip) return { ok: false, error: "Captura el NIP de supervisor para autorizar la cancelación" };

  const valido = await verifyPassword(nip, hash);
  if (!valido) return { ok: false, error: "NIP de supervisor incorrecto" };

  return { ok: true, autorizadoConNip: true };
}
