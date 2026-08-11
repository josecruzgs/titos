import { Schema, model, models, type InferSchemaType } from "mongoose";

// Los dólares viven en su propio cajón: un retiro en USD no toca el efectivo en pesos.
export const MONEDAS_CAJA = ["MXN", "USD"] as const;

const MovimientoCajaSchema = new Schema(
  {
    folio: { type: String, required: true, unique: true },
    cajaSesionId: { type: Schema.Types.ObjectId, ref: "CajaSesion", required: true },
    sucursalId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    tipo: { type: String, enum: ["retiro"], default: "retiro" },
    moneda: { type: String, enum: MONEDAS_CAJA, default: "MXN" },
    monto: { type: Number, required: true },
    motivo: { type: String, required: true },
    // Usuario que capturó el retiro y confirmó su contraseña para autorizarlo.
    usuarioId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    usuarioNombre: { type: String, default: "" },
    fecha: { type: Date, default: Date.now },
    corte: { type: String, required: true }, // YYYY-MM-DD
  },
  { timestamps: true }
);

MovimientoCajaSchema.index({ sucursalId: 1, fecha: -1 });
MovimientoCajaSchema.index({ cajaSesionId: 1 });

export type MovimientoCaja = InferSchemaType<typeof MovimientoCajaSchema> & { _id: string };

export default models.MovimientoCaja || model("MovimientoCaja", MovimientoCajaSchema);
