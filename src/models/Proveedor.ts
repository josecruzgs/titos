import { Schema, model, models, type InferSchemaType } from "mongoose";

const ProveedorSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    contacto: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    email: { type: String, default: "" },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type Proveedor = InferSchemaType<typeof ProveedorSchema> & { _id: string };

export default models.Proveedor || model("Proveedor", ProveedorSchema);
