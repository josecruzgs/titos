import { Schema, model, models, type InferSchemaType } from "mongoose";

const SolicitudProductoNuevoSchema = new Schema(
  {
    sucursalId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    pedidoId: { type: Schema.Types.ObjectId, ref: "Pedido", default: null },
    nombreSugerido: { type: String, required: true },
    descripcion: { type: String, default: "" },
    unidad: { type: String, enum: ["pieza", "kg"], required: true },
    cantidadSugerida: { type: Number, required: true },
    estado: { type: String, enum: ["pendiente", "convertida"], default: "pendiente" },
    necesidadCompraId: { type: Schema.Types.ObjectId, ref: "NecesidadCompra", default: null },
  },
  { timestamps: true }
);

export type SolicitudProductoNuevo = InferSchemaType<typeof SolicitudProductoNuevoSchema> & { _id: string };

export default models.SolicitudProductoNuevo ||
  model("SolicitudProductoNuevo", SolicitudProductoNuevoSchema);
