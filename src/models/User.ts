import { Schema, model, models, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    nombre: { type: String, required: true },
    role: { type: String, enum: ["matriz", "sucursal"], required: true },
    // Rol interno dentro de la sucursal: admin (todo) o ventas (solo punto de venta)
    sucursalRol: { type: String, enum: ["admin", "ventas"], default: "admin" },
    sucursalId: { type: Schema.Types.ObjectId, ref: "Sucursal", default: null },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type User = InferSchemaType<typeof UserSchema> & { _id: string };

export default models.User || model("User", UserSchema);
