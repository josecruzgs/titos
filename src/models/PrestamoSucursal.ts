import { Schema, model, models, type InferSchemaType } from "mongoose";

// solicitado → aprobado (sale de quien presta) → recibido (entra a quien pide)
//            → devuelto (regresa)      |→ rechazado / cancelado
export const ESTADOS_PRESTAMO = ["solicitado", "aprobado", "recibido", "devuelto", "rechazado", "cancelado"] as const;

const PrestamoItemSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: "Producto", required: true },
    sku: { type: String, required: true },
    nombreProducto: { type: String, required: true },
    unidad: { type: String, enum: ["pieza", "kg"], required: true },
    cantidadSolicitada: { type: Number, required: true },
    // Lo que la sucursal que presta realmente autorizó (puede ser menos).
    cantidadEntregada: { type: Number, default: 0 },
    cantidadDevuelta: { type: Number, default: 0 },
  },
  { _id: false }
);

const PrestamoSucursalSchema = new Schema(
  {
    folio: { type: String, required: true, unique: true },
    sucursalSolicitanteId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    sucursalSolicitanteNombre: { type: String, default: "" },
    sucursalPrestamistaId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    sucursalPrestamistaNombre: { type: String, default: "" },
    items: { type: [PrestamoItemSchema], default: [] },
    estado: { type: String, enum: ESTADOS_PRESTAMO, default: "solicitado" },
    notas: { type: String, default: "" },
    motivoRechazo: { type: String, default: "" },

    solicitadoPorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    solicitadoEn: { type: Date, default: Date.now },
    resueltoPorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resueltoEn: { type: Date, default: null },
    recibidoPorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    recibidoEn: { type: Date, default: null },
    devueltoEn: { type: Date, default: null },
  },
  { timestamps: true }
);

PrestamoSucursalSchema.index({ sucursalSolicitanteId: 1, estado: 1, createdAt: -1 });
PrestamoSucursalSchema.index({ sucursalPrestamistaId: 1, estado: 1, createdAt: -1 });

export type PrestamoSucursal = InferSchemaType<typeof PrestamoSucursalSchema> & { _id: string };

export default models.PrestamoSucursal || model("PrestamoSucursal", PrestamoSucursalSchema);
