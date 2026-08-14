import { Schema, model, models, type InferSchemaType } from "mongoose";
import { DIAS_SEMANA } from "@/lib/dias";

const ConfiguracionSchema = new Schema(
  {
    diasLaborales: { type: [String], enum: DIAS_SEMANA, default: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] },
    horaCorte: { type: String, default: "16:00" },
    tipoCambio: { type: Number, default: 17 },
    // NIP con el que un supervisor autoriza las cancelaciones en los puntos de
    // venta (matriz y sucursales). Se guarda hasheado y nunca se devuelve por la
    // API: solo se informa si ya está configurado.
    nipSupervisorHash: { type: String, default: "" },
    // Tasa de IVA con la que se generan las facturas del sistema. La mayoría del
    // abarrote es tasa 0%, por eso el default no es 16.
    tasaIvaFactura: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

export type Configuracion = InferSchemaType<typeof ConfiguracionSchema> & { _id: string };

export default models.Configuracion || model("Configuracion", ConfiguracionSchema);
