import { normalizarWhatsAppMX } from "@/lib/whatsapp";

function credencialesEvolution() {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;

  if (!baseUrl || !apiKey || !instance) {
    throw new Error("Evolution API no está configurada (faltan variables de entorno)");
  }

  return { baseUrl, apiKey, instance };
}

// Envía mensajes de WhatsApp a través de una instancia propia de Evolution
// API (https://github.com/EvolutionAPI/evolution-api). Sólo debe llamarse
// desde el servidor: la apikey nunca debe llegar al navegador.
export async function enviarWhatsApp(numero: string, mensaje: string) {
  const { baseUrl, apiKey, instance } = credencialesEvolution();

  const numeroNormalizado = normalizarWhatsAppMX(numero);
  if (!numeroNormalizado) {
    throw new Error("El número de WhatsApp no es válido");
  }

  const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({ number: numeroNormalizado, text: mensaje }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Evolution API respondió ${res.status}: ${detalle.slice(0, 300)}`);
  }

  return res.json();
}

// Envía un documento (PDF, etc.) adjunto con un texto corto de acompañamiento
// ("caption"), en lugar de un mensaje de texto largo.
export async function enviarWhatsAppDocumento(
  numero: string,
  archivoBase64: string,
  nombreArchivo: string,
  caption: string
) {
  const { baseUrl, apiKey, instance } = credencialesEvolution();

  const numeroNormalizado = normalizarWhatsAppMX(numero);
  if (!numeroNormalizado) {
    throw new Error("El número de WhatsApp no es válido");
  }

  const res = await fetch(`${baseUrl}/message/sendMedia/${instance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({
      number: numeroNormalizado,
      mediatype: "document",
      mimetype: "application/pdf",
      fileName: nombreArchivo,
      caption,
      media: archivoBase64,
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Evolution API respondió ${res.status}: ${detalle.slice(0, 300)}`);
  }

  return res.json();
}

export type EstadoConexionWhatsApp = "open" | "connecting" | "close";

// Consulta si la sesión de WhatsApp de la instancia está vinculada (Evolution
// API mantiene una sola sesión por instancia, compartida por toda la app).
export async function obtenerEstadoConexion(): Promise<EstadoConexionWhatsApp> {
  const { baseUrl, apiKey, instance } = credencialesEvolution();

  const res = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
    headers: { apikey: apiKey },
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Evolution API respondió ${res.status}: ${detalle.slice(0, 300)}`);
  }

  const data = await res.json();
  return (data?.instance?.state ?? data?.state ?? "close") as EstadoConexionWhatsApp;
}

// Pide un código QR nuevo para vincular WhatsApp a la instancia.
export async function obtenerCodigoQR(): Promise<{ qr: string | null; pairingCode: string | null }> {
  const { baseUrl, apiKey, instance } = credencialesEvolution();

  const res = await fetch(`${baseUrl}/instance/connect/${instance}`, {
    headers: { apikey: apiKey },
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Evolution API respondió ${res.status}: ${detalle.slice(0, 300)}`);
  }

  const data = await res.json();
  return {
    qr: data?.base64 ?? data?.qrcode?.base64 ?? null,
    pairingCode: data?.pairingCode ?? null,
  };
}

// Cierra la sesión de WhatsApp vinculada (la instancia sigue existiendo, sólo
// se desvincula el teléfono; hay que volver a escanear un QR para reconectar).
export async function desconectarWhatsApp() {
  const { baseUrl, apiKey, instance } = credencialesEvolution();

  const res = await fetch(`${baseUrl}/instance/logout/${instance}`, {
    method: "DELETE",
    headers: { apikey: apiKey },
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Evolution API respondió ${res.status}: ${detalle.slice(0, 300)}`);
  }

  return res.json();
}
