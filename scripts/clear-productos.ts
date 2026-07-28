import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { connectDB } from "../src/lib/db";
import Producto from "../src/models/Producto";
import Pedido from "../src/models/Pedido";
import InventarioSucursal from "../src/models/InventarioSucursal";
import MovimientoInventario from "../src/models/MovimientoInventario";
import NecesidadCompra from "../src/models/NecesidadCompra";
import OrdenCompra from "../src/models/OrdenCompra";

async function clear() {
  await connectDB();
  console.log("Conectado a MongoDB. Vaciando productos y colecciones dependientes...");

  const results = await Promise.all([
    Producto.deleteMany({}),
    Pedido.deleteMany({}),
    InventarioSucursal.deleteMany({}),
    MovimientoInventario.deleteMany({}),
    NecesidadCompra.deleteMany({}),
    OrdenCompra.deleteMany({}),
  ]);

  const [productos, pedidos, inventario, movimientos, necesidades, ordenes] = results;
  console.log(`Productos eliminados: ${productos.deletedCount}`);
  console.log(`Pedidos eliminados: ${pedidos.deletedCount}`);
  console.log(`InventarioSucursal eliminados: ${inventario.deletedCount}`);
  console.log(`MovimientoInventario eliminados: ${movimientos.deletedCount}`);
  console.log(`NecesidadCompra eliminados: ${necesidades.deletedCount}`);
  console.log(`OrdenCompra eliminados: ${ordenes.deletedCount}`);
  console.log("\nListo. Ya puedes cargar el catálogo de productos real.");

  process.exit(0);
}

clear().catch((err) => {
  console.error(err);
  process.exit(1);
});
