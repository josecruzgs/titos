import { Schema, model, models, type InferSchemaType } from "mongoose";

const InventarioSucursalSchema = new Schema(
  {
    sucursalId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    productoId: { type: Schema.Types.ObjectId, ref: "Producto", required: true },
    stockActual: { type: Number, required: true, default: 0 },
    stockMinimo: { type: Number, default: 0 },
    stockMaximo: { type: Number, default: 0 },
  },
  { timestamps: true }
);

InventarioSucursalSchema.index({ sucursalId: 1, productoId: 1 }, { unique: true });

export type InventarioSucursal = InferSchemaType<typeof InventarioSucursalSchema> & { _id: string };

export default models.InventarioSucursal || model("InventarioSucursal", InventarioSucursalSchema);
