import { Schema, model, models, type InferSchemaType } from "mongoose";
import { DIAS_SEMANA } from "@/lib/dias";

// Reglas con las que el punto de venta recibe dólares en billete.
const ConfiguracionDolaresSchema = new Schema(
  {
    aceptaPagos: { type: Boolean, default: true },
    // 0 = se aceptan todas las denominaciones, que es la política actual. Al
    // poner un tope (por ejemplo 50) el punto de venta le avisa al cajero que no
    // debe recibir billetes por encima de esa denominación. Es configurable a
    // propósito: el día que el negocio decida rechazar los de 100 se cambia
    // aquí, sin tocar código ni volver a desplegar.
    denominacionMaxima: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

// Avisos automáticos de pedidos que se quedaron atorados. Los dispara el
// barrido de /api/cron/alertas.
const ConfiguracionAlertasSchema = new Schema(
  {
    activas: { type: Boolean, default: true },
    /** Horas desde que la sucursal levantó el pedido para que matriz lo surta. */
    horasLimiteSurtido: { type: Number, default: 24, min: 1 },
    /** Horas desde que matriz surtió para que la sucursal confirme la recepción. */
    horasLimiteRecepcion: { type: Number, default: 24, min: 1 },
    /**
     * WhatsApp de quienes reciben los avisos de surtido atrasado (matriz). Los
     * de recepción atrasada van al WhatsApp de la sucursal correspondiente.
     */
    destinatarios: { type: [String], default: [] },
  },
  { _id: false }
);

const ConfiguracionSchema = new Schema(
  {
    diasLaborales: { type: [String], enum: DIAS_SEMANA, default: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] },
    horaCorte: { type: String, default: "16:00" },
    tipoCambio: { type: Number, default: 17 },
    dolares: { type: ConfiguracionDolaresSchema, default: () => ({}) },
    alertas: { type: ConfiguracionAlertasSchema, default: () => ({}) },
    // NIP con el que un supervisor autoriza las cancelaciones en los puntos de
    // venta (matriz y sucursales). Se guarda hasheado y nunca se devuelve por la
    // API: solo se informa si ya está configurado.
    nipSupervisorHash: { type: String, default: "" },
    // Tasa de IVA con la que se generan las facturas del sistema. La mayoría del
    // abarrote es tasa 0%, por eso el default no es 16.
    tasaIvaFactura: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

export type Configuracion = InferSchemaType<typeof ConfiguracionSchema> & { _id: string };

export default models.Configuracion || model("Configuracion", ConfiguracionSchema);
