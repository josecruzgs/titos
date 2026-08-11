import {
  REGIMENES_FISCALES_VALORES,
  USOS_CFDI_VALORES,
  esRfcValido,
  normalizarRfc,
} from "@/lib/facturacion";

export type ClienteInput = {
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  notas: string;
  activo: boolean;
  credito: { activo: boolean; limite: number; diasCredito: number };
  facturacion: {
    razonSocial: string;
    rfc: string;
    regimenFiscal: string;
    usoCfdi: string;
    codigoPostal: string;
    direccionFiscal: string;
    emailFacturacion: string;
  };
};

type Body = Record<string, unknown>;

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Valida y normaliza el cuerpo de alta/edición de un cliente.
 * `parcial` (PATCH) solo exige los campos que vengan en el body.
 */
export function parseClienteBody(
  body: Body,
  { parcial = false }: { parcial?: boolean } = {}
): { error: string } | { data: Partial<ClienteInput> } {
  const data: Partial<ClienteInput> = {};

  if (!parcial || "nombre" in body) {
    const nombre = texto(body.nombre);
    if (!nombre) return { error: "El nombre del cliente es obligatorio" };
    data.nombre = nombre;
  }

  for (const campo of ["telefono", "email", "direccion", "notas"] as const) {
    if (!parcial || campo in body) data[campo] = texto(body[campo]);
  }

  if ("activo" in body) data.activo = !!body.activo;

  if (!parcial || "credito" in body) {
    const credito = (body.credito ?? {}) as Body;
    const activo = !!credito.activo;
    const limite = Number(credito.limite ?? 0);
    const diasCredito = Number(credito.diasCredito ?? 30);

    if (!Number.isFinite(limite) || limite < 0) return { error: "El límite de crédito debe ser un monto válido" };
    if (!Number.isInteger(diasCredito) || diasCredito < 1 || diasCredito > 365) {
      return { error: "El plazo de crédito debe ser un número entero de 1 a 365 días" };
    }
    if (activo && limite <= 0) return { error: "Si el cliente tiene crédito, asígnale un límite mayor a cero" };

    data.credito = { activo, limite, diasCredito };
  }

  if (!parcial || "facturacion" in body) {
    const f = (body.facturacion ?? {}) as Body;
    const rfc = texto(f.rfc) ? normalizarRfc(texto(f.rfc)) : "";
    if (rfc && !esRfcValido(rfc)) return { error: "El RFC no tiene un formato válido" };

    const regimenFiscal = texto(f.regimenFiscal);
    if (regimenFiscal && !REGIMENES_FISCALES_VALORES.includes(regimenFiscal as never)) {
      return { error: "Régimen fiscal inválido" };
    }

    const usoCfdi = texto(f.usoCfdi);
    if (usoCfdi && !USOS_CFDI_VALORES.includes(usoCfdi as never)) return { error: "Uso de CFDI inválido" };

    const codigoPostal = texto(f.codigoPostal);
    if (codigoPostal && !/^\d{5}$/.test(codigoPostal)) return { error: "El código postal debe tener 5 dígitos" };

    data.facturacion = {
      razonSocial: texto(f.razonSocial),
      rfc,
      regimenFiscal,
      usoCfdi,
      codigoPostal,
      direccionFiscal: texto(f.direccionFiscal),
      emailFacturacion: texto(f.emailFacturacion).toLowerCase(),
    };
  }

  return { data };
}
