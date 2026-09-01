import { Schema, model, models, type InferSchemaType } from "mongoose";

// Tabla de aprendizaje de BINs de tarjetas de vales.
//
// No existe un catálogo público y confiable de qué BIN pertenece a cada emisor
// mexicano, y adivinarlos sería peor que no tenerlos: una tarjeta mal
// clasificada se le cobraría al emisor equivocado. Así que el sistema aprende:
// la primera vez que se pasa una tarjeta cuyo BIN no conoce, el cajero elige el
// emisor una sola vez y a partir de ahí esa tarjeta se identifica sola.

const BinValeSchema = new Schema(
  {
    // Primeros 6 dígitos de la tarjeta. No se guarda el número completo.
    bin: { type: String, required: true, unique: true, trim: true },
    emisorId: { type: Schema.Types.ObjectId, ref: "EmisorVale", default: null },
    emisorNombre: { type: String, default: "" },
    veces: { type: Number, default: 0 },
    primeraVez: { type: Date, default: Date.now },
    ultimaVez: { type: Date, default: Date.now },
    // Quién enseñó el sistema, por si hay que revisar una clasificación dudosa.
    asignadoPorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

BinValeSchema.index({ emisorId: 1 });

export type BinVale = InferSchemaType<typeof BinValeSchema> & { _id: string };

export default models.BinVale || model("BinVale", BinValeSchema);
