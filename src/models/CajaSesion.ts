import { Schema, model, models, type InferSchemaType } from "mongoose";

export const ESTADOS_CAJA = ["abierta", "cerrada"] as const;

const CajaSesionSchema = new Schema(
  {
    sucursalId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    estado: { type: String, enum: ESTADOS_CAJA, default: "abierta" },
    usuarioAperturaId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fechaApertura: { type: Date, default: Date.now },
    efectivoInicial: { type: Number, required: true, default: 0 },
    efectivoInicialUsd: { type: Number, default: 0 }, // fondo del cajón de dólares
    usuarioCierreId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    fechaCierre: { type: Date, default: null },
    totalVentasEfectivo: { type: Number, default: null },
    totalVentasTarjeta: { type: Number, default: null },
    totalVentasTransferencia: { type: Number, default: null },
    totalVentasVales: { type: Number, default: null }, // vales de despensa recibidos: se cobran al emisor, no al cajón
    totalVentasCredito: { type: Number, default: null }, // no es efectivo en caja, es cartera generada en el turno
    totalAbonosEfectivo: { type: Number, default: null }, // cobranza de clientes recibida en el turno
    totalDevoluciones: { type: Number, default: null }, // reembolsos pagados en el turno
    totalRetiros: { type: Number, default: null },
    efectivoEsperado: { type: Number, default: null },
    efectivoContado: { type: Number, default: null },
    diferencia: { type: Number, default: null },
    // Cajón de dólares, independiente del de pesos
    totalRetirosUsd: { type: Number, default: null },
    efectivoEsperadoUsd: { type: Number, default: null },
    efectivoContadoUsd: { type: Number, default: null },
    diferenciaUsd: { type: Number, default: null },
    notas: { type: String, default: "" },
  },
  { timestamps: true }
);

CajaSesionSchema.index({ sucursalId: 1, estado: 1 });

export type CajaSesion = InferSchemaType<typeof CajaSesionSchema> & { _id: string };

export default models.CajaSesion || model("CajaSesion", CajaSesionSchema);
