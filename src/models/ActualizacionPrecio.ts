import { Schema, model, models, type InferSchemaType } from "mongoose";

const ActualizacionPrecioSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: "Producto", required: true },
    // Snapshot al momento del cambio, por si el producto se edita o elimina después
    sku: { type: String, required: true },
    nombre: { type: String, required: true },
    precioAnterior: { type: Number, required: true },
    precioNuevo: { type: Number, required: true },
    origen: { type: String, enum: ["excel", "manual"], required: true },
    usuarioId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

ActualizacionPrecioSchema.index({ createdAt: -1 });

export type ActualizacionPrecio = InferSchemaType<typeof ActualizacionPrecioSchema> & { _id: string };

export default models.ActualizacionPrecio || model("ActualizacionPrecio", ActualizacionPrecioSchema);
