import { Schema, model, models, type InferSchemaType } from "mongoose";

const ProductoProveedorSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: "Producto", required: true },
    proveedorId: { type: Schema.Types.ObjectId, ref: "Proveedor", required: true },
    costo: { type: Number, required: true, default: 0 },
    ivaPct: { type: Number, default: 0 },
    iepsPct: { type: Number, default: 0 },
    costoUnitario: { type: Number, required: true, default: 0 },
    esPrincipal: { type: Boolean, default: false },
    activo: { type: Boolean, default: true },
    observaciones: { type: String, default: "" },
  },
  { timestamps: true }
);

ProductoProveedorSchema.index({ productoId: 1, proveedorId: 1 }, { unique: true });

export type ProductoProveedor = InferSchemaType<typeof ProductoProveedorSchema> & { _id: string };

export default models.ProductoProveedor || model("ProductoProveedor", ProductoProveedorSchema);
