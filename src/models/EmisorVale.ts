import { Schema, model, models, type InferSchemaType } from "mongoose";

// Emisor de vales de despensa (Sí Vale/Edenred, Pluxee/Sodexo, Broxel, Toka,
// Efectivale...). Cada uno se cobra por separado, así que el corte necesita
// saber de quién es cada vale recibido.

const EmisorValeSchema = new Schema(
  {
    nombre: { type: String, required: true, unique: true, trim: true },
    // Prefijos BIN (los primeros dígitos de la tarjeta) que identifican a este
    // emisor. Se llenan solos conforme se pasan tarjetas en el punto de venta:
    // ver models/BinVale.
    prefijosBin: { type: [String], default: [] },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type EmisorVale = InferSchemaType<typeof EmisorValeSchema> & { _id: string };

export default models.EmisorVale || model("EmisorVale", EmisorValeSchema);
