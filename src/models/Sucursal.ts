import { Schema, model, models, type InferSchemaType } from "mongoose";

const SucursalSchema = new Schema(
  {
    nombre: { type: String, required: true },
    clave: { type: String, trim: true, unique: true, sparse: true },
    direccion: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type Sucursal = InferSchemaType<typeof SucursalSchema> & { _id: string };

export default models.Sucursal || model("Sucursal", SucursalSchema);
