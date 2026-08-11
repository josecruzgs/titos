import { Schema, model, models, type InferSchemaType } from "mongoose";

export const METODOS_ABONO = ["efectivo", "tarjeta", "transferencia"] as const;

const AplicacionSchema = new Schema(
  {
    cuentaId: { type: Schema.Types.ObjectId, ref: "CuentaPorCobrar", required: true },
    folio: { type: String, required: true },
    monto: { type: Number, required: true },
  },
  { _id: false }
);

// Pago que hace el cliente contra su deuda. Se aplica a las cuentas por cobrar
// abiertas de la más vieja a la más nueva (FIFO) y queda registrado en qué
// cuentas cayó. Un abono en efectivo entra al corte de la caja abierta.

const AbonoClienteSchema = new Schema(
  {
    clienteId: { type: Schema.Types.ObjectId, ref: "Cliente", required: true },
    sucursalId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    cajaSesionId: { type: Schema.Types.ObjectId, ref: "CajaSesion", default: null },
    usuarioId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fecha: { type: Date, default: Date.now },
    corte: { type: String, required: true }, // YYYY-MM-DD
    monto: { type: Number, required: true },
    metodoPago: { type: String, enum: METODOS_ABONO, required: true },
    aplicaciones: { type: [AplicacionSchema], default: [] },
    notas: { type: String, default: "" },
  },
  { timestamps: true }
);

AbonoClienteSchema.index({ clienteId: 1, fecha: -1 });
AbonoClienteSchema.index({ cajaSesionId: 1 });

export type AbonoCliente = InferSchemaType<typeof AbonoClienteSchema> & { _id: string };

export default models.AbonoCliente || model("AbonoCliente", AbonoClienteSchema);
