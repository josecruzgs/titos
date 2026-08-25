import { Schema, model, models, type InferSchemaType } from "mongoose";

export const ESTADOS_VENTAS2 = ["programada", "activa", "finalizada", "cancelada"] as const;
export const ESTADOS_NOTIFICACION_VENTAS2 = ["pendiente", "enviada", "fallida", "sin_whatsapp"] as const;

const NotificacionVentas2Schema = new Schema(
  {
    estado: { type: String, enum: ESTADOS_NOTIFICACION_VENTAS2, default: "pendiente" },
    fecha: { type: Date, default: null },
    error: { type: String, default: "" },
  },
  { _id: false }
);

const Ventas2ActivacionSchema = new Schema(
  {
    sucursalId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    inicio: { type: Date, required: true },
    // `null` = protocolo indefinido: corre hasta que alguien lo detenga a mano
    // desde matriz. Al detenerlo se sella con la fecha del momento.
    fin: { type: Date, default: null },
    frecuencia: { type: Number, required: true, min: 1 },
    estado: { type: String, enum: ESTADOS_VENTAS2, default: "programada" },
    creadoPorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    finalizadoManualPorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    finalizadoManualEn: { type: Date, default: null },
    notificacionInicio: { type: NotificacionVentas2Schema, default: () => ({}) },
    notificacionFin: { type: NotificacionVentas2Schema, default: () => ({}) },
    retiradoEn: { type: Date, default: null },
    retiradoPorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

Ventas2ActivacionSchema.index({ sucursalId: 1, inicio: 1, fin: 1 });
Ventas2ActivacionSchema.index({ estado: 1, inicio: 1, fin: 1 });

export type Ventas2Activacion = InferSchemaType<typeof Ventas2ActivacionSchema> & { _id: string };

export default models.Ventas2Activacion || model("Ventas2Activacion", Ventas2ActivacionSchema);
