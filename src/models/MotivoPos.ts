import { Schema, model, models, type InferSchemaType } from "mongoose";
import { LARGO_MAXIMO_MOTIVO, TIPOS_MOTIVO_POS } from "@/lib/motivosPos";

// Motivo predeterminado de cancelación o devolución. Lo da de alta matriz en
// /matriz/configuracion y lo eligen los puntos de venta de matriz y sucursales.

const MotivoPosSchema = new Schema(
  {
    tipo: { type: String, enum: TIPOS_MOTIVO_POS, required: true },
    texto: { type: String, required: true, trim: true, maxlength: LARGO_MAXIMO_MOTIVO },
    // Un motivo que se deja de usar se desactiva en vez de borrarse, para no
    // dejar huérfanas las cancelaciones viejas que lo citan.
    activo: { type: Boolean, default: true },
    orden: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// No tiene caso tener dos veces el mismo motivo para el mismo tipo.
MotivoPosSchema.index({ tipo: 1, texto: 1 }, { unique: true });
MotivoPosSchema.index({ tipo: 1, activo: 1, orden: 1 });

export type MotivoPos = InferSchemaType<typeof MotivoPosSchema> & { _id: string };

export default models.MotivoPos || model("MotivoPos", MotivoPosSchema);
