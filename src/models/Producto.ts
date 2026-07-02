import { Schema, model, models, type InferSchemaType } from "mongoose";
import { CATEGORIA_VALUES } from "@/lib/categorias";

const ProductoSchema = new Schema(
  {
    sku: { type: String, required: true, unique: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    categoria: { type: String, enum: CATEGORIA_VALUES, required: true },
    unidad: { type: String, enum: ["pieza", "kg"], required: true },
    requierePesaje: { type: Boolean, default: false },
    precio: { type: Number, required: true, default: 0 },
    existenciaMatriz: { type: Number, required: true, default: 0 },
    stockMinimo: { type: Number, default: 0 },
    proveedorPreferidoId: { type: Schema.Types.ObjectId, ref: "Proveedor", default: null },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type Producto = InferSchemaType<typeof ProductoSchema> & { _id: string };

export default models.Producto || model("Producto", ProductoSchema);
