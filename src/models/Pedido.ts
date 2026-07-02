import { Schema, model, models, type InferSchemaType } from "mongoose";

export const ESTADOS_PEDIDO = ["pendiente", "nivelado", "surtido", "recibido"] as const;

const PedidoItemSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: "Producto", required: true },
    nombreProducto: { type: String, required: true },
    unidad: { type: String, enum: ["pieza", "kg"], required: true },
    requierePesaje: { type: Boolean, default: false },
    cantidadPedida: { type: Number, required: true },
    cantidadAsignada: { type: Number, default: null },
    cantidadSurtida: { type: Number, default: null },
    pesoSurtidoKg: { type: Number, default: null },
    cantidadRecibida: { type: Number, default: null },
    pesoRecibidoKg: { type: Number, default: null },
  },
  { _id: false }
);

const PedidoSchema = new Schema(
  {
    folio: { type: String, required: true, unique: true },
    sucursalId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    fecha: { type: Date, required: true, default: Date.now },
    corte: { type: String, required: true }, // YYYY-MM-DD del corte de las 4pm al que pertenece
    estado: { type: String, enum: ESTADOS_PEDIDO, default: "pendiente" },
    items: { type: [PedidoItemSchema], default: [] },
  },
  { timestamps: true }
);

export type Pedido = InferSchemaType<typeof PedidoSchema> & { _id: string };

export default models.Pedido || model("Pedido", PedidoSchema);
