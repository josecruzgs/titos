import { Schema, model, models, type InferSchemaType } from "mongoose";

const CategoriaProductoSchema = new Schema(
  {
    nombre: { type: String, required: true, unique: true, trim: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type CategoriaProducto = InferSchemaType<typeof CategoriaProductoSchema> & { _id: string };

export default models.CategoriaProducto || model("CategoriaProducto", CategoriaProductoSchema);
