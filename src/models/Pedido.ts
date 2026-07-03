import { Schema, model, models, type InferSchemaType } from "mongoose";

export const ESTADOS_PEDIDO = ["pendiente", "nivelado", "surtido", "recibido"] as const;

const PedidoItemSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: "Producto", required: true },
    nombreProducto: { type: String, required: true },
    categoria: { type: String, default: "" },
    unidad: { type: String, enum: ["pieza", "kg"], required: true },
    requierePesaje: { type: Boolean, default: false },
    precioVenta: { type: Number, default: 0 },
    cantidadPedida: { type: Number, required: true },
    cantidadAsignada: { type: Number, default: null },
    cantidadSurtida: { type: Number, default: null },
    pesoSurtidoKg: { type: Number, default: null },
    cantidadRecibida: { type: Number, default: null },
    pesoRecibidoKg: { type: Number, default: null },
  },
  { _id: false }
);

// Una caja física en la que se empaca y sella (con dos cinchos numerados)
// parte del surtido. Es información de trazabilidad adicional: no
// reemplaza la cantidad surtida por producto.
const CajaSchema = new Schema(
  {
    numero: { type: String, required: true },
    cincho1: { type: String, required: true },
    cincho2: { type: String, required: true },
    categoria: { type: String, default: "" },
    items: [
      {
        _id: false,
        productoId: { type: Schema.Types.ObjectId, ref: "Producto", required: true },
        nombreProducto: { type: String, required: true },
        cantidad: { type: Number, required: true },
      },
    ],
  },
  { _id: false, timestamps: true }
);

const PedidoSchema = new Schema(
  {
    folio: { type: String, required: true, unique: true },
    sucursalId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    fecha: { type: Date, required: true, default: Date.now },
    corte: { type: String, required: true }, // YYYY-MM-DD del corte de las 4pm al que pertenece
    estado: { type: String, enum: ESTADOS_PEDIDO, default: "pendiente" },
    repartidorId: { type: Schema.Types.ObjectId, ref: "Empleado", default: null },
    items: { type: [PedidoItemSchema], default: [] },
    cajas: { type: [CajaSchema], default: [] },
  },
  { timestamps: true }
);

export type Pedido = InferSchemaType<typeof PedidoSchema> & { _id: string };

export default models.Pedido || model("Pedido", PedidoSchema);
