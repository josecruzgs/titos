import { Schema, model, models, type InferSchemaType } from "mongoose";
import { DIAS_SEMANA } from "@/lib/dias";

const ConfiguracionSchema = new Schema(
  {
    diasLaborales: { type: [String], enum: DIAS_SEMANA, default: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] },
    horaCorte: { type: String, default: "16:00" },
    tipoCambio: { type: Number, default: 17 },
  },
  { timestamps: true }
);

export type Configuracion = InferSchemaType<typeof ConfiguracionSchema> & { _id: string };

export default models.Configuracion || model("Configuracion", ConfiguracionSchema);
