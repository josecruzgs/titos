import { Schema, model, models, type InferSchemaType } from "mongoose";

export const ESTADOS_CUENTA = ["pendiente", "pagada", "cancelada"] as const;

// Una cuenta por cobrar por cada venta a crédito. `saldo` baja conforme el
// cliente abona; al llegar a cero la cuenta pasa a "pagada".

const CuentaPorCobrarSchema = new Schema(
  {
    clienteId: { type: Schema.Types.ObjectId, ref: "Cliente", required: true },
    sucursalId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    ventaId: { type: Schema.Types.ObjectId, ref: "Venta", required: true },
    folio: { type: String, required: true },
    fecha: { type: Date, required: true },
    fechaVencimiento: { type: Date, required: true },
    diasCredito: { type: Number, required: true },
    monto: { type: Number, required: true },
    saldo: { type: Number, required: true },
    estado: { type: String, enum: ESTADOS_CUENTA, default: "pendiente" },
  },
  { timestamps: true }
);

CuentaPorCobrarSchema.index({ clienteId: 1, estado: 1, fechaVencimiento: 1 });
CuentaPorCobrarSchema.index({ sucursalId: 1, estado: 1 });
CuentaPorCobrarSchema.index({ ventaId: 1 });

export type CuentaPorCobrar = InferSchemaType<typeof CuentaPorCobrarSchema> & { _id: string };

export default models.CuentaPorCobrar || model("CuentaPorCobrar", CuentaPorCobrarSchema);
