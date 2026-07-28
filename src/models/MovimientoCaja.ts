import { Schema, model, models, type InferSchemaType } from "mongoose";

const MovimientoCajaSchema = new Schema(
  {
    cajaSesionId: { type: Schema.Types.ObjectId, ref: "CajaSesion", required: true },
    sucursalId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    tipo: { type: String, enum: ["retiro"], default: "retiro" },
    monto: { type: Number, required: true },
    motivo: { type: String, required: true },
    usuarioId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fecha: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export type MovimientoCaja = InferSchemaType<typeof MovimientoCajaSchema> & { _id: string };

export default models.MovimientoCaja || model("MovimientoCaja", MovimientoCajaSchema);
