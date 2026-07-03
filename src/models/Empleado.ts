import { Schema, model, models, type InferSchemaType } from "mongoose";

const EmpleadoSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    puesto: { type: String, default: "" },
    whatsapp: { type: String, required: true, trim: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type Empleado = InferSchemaType<typeof EmpleadoSchema> & { _id: string };

export default models.Empleado || model("Empleado", EmpleadoSchema);
