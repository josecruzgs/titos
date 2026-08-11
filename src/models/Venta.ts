import { Schema, model, models, type InferSchemaType } from "mongoose";

// "credito" no entra dinero a la caja: genera una cuenta por cobrar del cliente.
export const METODOS_PAGO = ["efectivo", "tarjeta", "transferencia", "credito"] as const;
export const METODOS_PAGO_CONTADO = ["efectivo", "tarjeta", "transferencia"] as const;
export const ESTADOS_VENTA = ["completada", "cancelada"] as const;

const VentaItemSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: "Producto", required: true },
    sku: { type: String, required: true },
    nombreProducto: { type: String, required: true },
    unidad: { type: String, enum: ["pieza", "kg"], required: true },
    cantidad: { type: Number, required: true },
    precioUnitario: { type: Number, required: true },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const PagoVentaSchema = new Schema(
  {
    metodoPago: { type: String, enum: METODOS_PAGO, required: true },
    monto: { type: Number, required: true },
  },
  { _id: false }
);

const VentaSchema = new Schema(
  {
    folio: { type: String, required: true, unique: true },
    sucursalId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    cajaSesionId: { type: Schema.Types.ObjectId, ref: "CajaSesion", required: true },
    usuarioId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fecha: { type: Date, default: Date.now },
    corte: { type: String, required: true }, // YYYY-MM-DD, útil para cortes de caja futuros
    items: { type: [VentaItemSchema], default: [] },
    total: { type: Number, required: true },
    // Pago mixto: la suma de pagos[].monto debe ser igual a total. Puede incluir
    // más de un método (ej. una parte en efectivo y otra con tarjeta).
    pagos: { type: [PagoVentaSchema], required: true, default: [] },
    montoRecibido: { type: Number, default: null }, // efectivo entregado por el cliente (solo si hay un pago en efectivo)
    cambio: { type: Number, default: null },
    // Cliente frecuente al que se le facturó/fió la venta. Obligatorio cuando
    // hay un pago con método "credito".
    clienteId: { type: Schema.Types.ObjectId, ref: "Cliente", default: null },
    clienteNombre: { type: String, default: "" },
    creditoMonto: { type: Number, default: null },
    creditoFechaVencimiento: { type: Date, default: null },
    esVentas2: { type: Boolean, default: false },
    ventas2ActivacionId: { type: Schema.Types.ObjectId, ref: "Ventas2Activacion", default: null },
    ventas2SecuenciaEfectivo: { type: Number, default: null },
    estado: { type: String, enum: ESTADOS_VENTA, default: "completada" },
  },
  { timestamps: true }
);

VentaSchema.index({ sucursalId: 1, createdAt: -1 });
VentaSchema.index({ sucursalId: 1, esVentas2: 1, corte: 1 });
VentaSchema.index({ ventas2ActivacionId: 1, estado: 1 });
VentaSchema.index({ clienteId: 1, createdAt: -1 });

export type Venta = InferSchemaType<typeof VentaSchema> & { _id: string };

export default models.Venta || model("Venta", VentaSchema);
