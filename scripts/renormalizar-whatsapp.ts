import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { connectDB } from "../src/lib/db";
import { normalizarWhatsAppMX } from "../src/lib/whatsapp";
import Sucursal from "../src/models/Sucursal";
import Empleado from "../src/models/Empleado";
import Proveedor from "../src/models/Proveedor";

async function renormalizar(nombre: string, Model: typeof Sucursal | typeof Empleado | typeof Proveedor) {
  const docs = await Model.find({ whatsapp: { $exists: true, $ne: "" } });
  let actualizados = 0;

  for (const doc of docs) {
    const actual = doc.get("whatsapp") as string;
    const normalizado = normalizarWhatsAppMX(actual);
    if (normalizado !== actual) {
      doc.set("whatsapp", normalizado);
      await doc.save();
      actualizados++;
    }
  }

  console.log(`${nombre}: ${actualizados} de ${docs.length} números actualizados.`);
}

async function run() {
  await connectDB();
  console.log("Re-normalizando números de WhatsApp guardados (quitando el '1' obsoleto para México)...");

  await renormalizar("Sucursales", Sucursal);
  await renormalizar("Empleados", Empleado);
  await renormalizar("Proveedores", Proveedor);

  console.log("Listo.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
