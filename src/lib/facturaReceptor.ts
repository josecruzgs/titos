import {
  REGIMENES_FISCALES_VALORES,
  USOS_CFDI_VALORES,
  esRfcValido,
  normalizarRfc,
} from "@/lib/facturacion";
import type { ReceptorFactura } from "@/lib/facturas";

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Valida los datos fiscales del receptor de una factura. A diferencia del alta
 * de clientes, aquí el RFC y la razón social sí son obligatorios: sin ellos el
 * documento no sirve para nada.
 */
export function parseReceptor(body: unknown): { error: string } | { data: ReceptorFactura } {
  const raw = (body ?? {}) as Record<string, unknown>;

  const razonSocial = texto(raw.razonSocial);
  if (!razonSocial) return { error: "Captura la razón social del receptor" };

  const rfc = normalizarRfc(texto(raw.rfc));
  if (!rfc) return { error: "Captura el RFC del receptor" };
  if (!esRfcValido(rfc)) return { error: "El RFC del receptor no tiene un formato válido" };

  const regimenFiscal = texto(raw.regimenFiscal);
  if (!regimenFiscal) return { error: "Selecciona el régimen fiscal del receptor" };
  if (!REGIMENES_FISCALES_VALORES.includes(regimenFiscal as never)) return { error: "Régimen fiscal inválido" };

  const usoCfdi = texto(raw.usoCfdi);
  if (!usoCfdi) return { error: "Selecciona el uso de CFDI" };
  if (!USOS_CFDI_VALORES.includes(usoCfdi as never)) return { error: "Uso de CFDI inválido" };

  const codigoPostal = texto(raw.codigoPostal);
  if (!codigoPostal) return { error: "Captura el código postal fiscal del receptor" };
  if (!/^\d{5}$/.test(codigoPostal)) return { error: "El código postal debe tener 5 dígitos" };

  return {
    data: {
      razonSocial,
      rfc,
      regimenFiscal,
      usoCfdi,
      codigoPostal,
      direccionFiscal: texto(raw.direccionFiscal),
      emailFacturacion: texto(raw.emailFacturacion).toLowerCase(),
    },
  };
}
