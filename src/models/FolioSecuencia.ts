import { Schema, model, models, type InferSchemaType } from "mongoose";

// Un contador por prefijo de folio ("VTA", "V2", ...). Vive en su propia
// colección para que el consecutivo se pueda incrementar de forma atómica
// aunque dos cajas cobren al mismo tiempo.

const FolioSecuenciaSchema = new Schema(
  {
    prefijo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    consecutivo: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export type FolioSecuencia = InferSchemaType<typeof FolioSecuenciaSchema> & { _id: string };

export default models.FolioSecuencia || model("FolioSecuencia", FolioSecuenciaSchema);
