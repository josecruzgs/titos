import { Schema, model, models, type InferSchemaType } from "mongoose";
import { REGIMENES_FISCALES_VALORES, USOS_CFDI_VALORES } from "@/lib/facturacion";

// Cada cliente pertenece a la sucursal que lo dio de alta: su crédito, su saldo
// y su historial son de esa sucursal.

const CreditoSchema = new Schema(
  {
    activo: { type: Boolean, default: false },
    // Tope de deuda vigente. La suma de cuentas por cobrar abiertas nunca puede rebasarlo.
    limite: { type: Number, default: 0, min: 0 },
    // Plazo de pago: cada venta a crédito vence a los N días de hecha.
    diasCredito: { type: Number, default: 30, min: 1, max: 365 },
  },
  { _id: false }
);

const FacturacionSchema = new Schema(
  {
    razonSocial: { type: String, default: "", trim: true },
    rfc: { type: String, default: "", trim: true, uppercase: true },
    regimenFiscal: { type: String, enum: ["", ...REGIMENES_FISCALES_VALORES], default: "" },
    usoCfdi: { type: String, enum: ["", ...USOS_CFDI_VALORES], default: "" },
    codigoPostal: { type: String, default: "", trim: true },
    direccionFiscal: { type: String, default: "", trim: true },
    emailFacturacion: { type: String, default: "", trim: true, lowercase: true },
  },
  { _id: false }
);

const ClienteSchema = new Schema(
  {
    sucursalId: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true },
    nombre: { type: String, required: true, trim: true },
    telefono: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    direccion: { type: String, default: "", trim: true },
    notas: { type: String, default: "" },
    activo: { type: Boolean, default: true },
    credito: { type: CreditoSchema, default: () => ({}) },
    facturacion: { type: FacturacionSchema, default: () => ({}) },
    // Saldo deudor vigente. Se mantiene sincronizado con las cuentas por cobrar
    // abiertas; `recalcularSaldoCliente` en lib/credito.ts es la fuente de verdad.
    saldo: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ClienteSchema.index({ sucursalId: 1, nombre: 1 });
ClienteSchema.index({ sucursalId: 1, activo: 1 });

export type Cliente = InferSchemaType<typeof ClienteSchema> & { _id: string };

export default models.Cliente || model("Cliente", ClienteSchema);
