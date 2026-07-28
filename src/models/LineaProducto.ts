import { Schema, model, models, type InferSchemaType } from "mongoose";

const LineaProductoSchema = new Schema(
  {
    nombre: { type: String, required: true, unique: true, trim: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type LineaProducto = InferSchemaType<typeof LineaProductoSchema> & { _id: string };

export default models.LineaProducto || model("LineaProducto", LineaProductoSchema);
