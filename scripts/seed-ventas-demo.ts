import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { connectDB } from "../src/lib/db";
import Sucursal from "../src/models/Sucursal";
import Producto from "../src/models/Producto";
import Pedido from "../src/models/Pedido";

const DIAS = 30;
const PREFIJO_FOLIO = "PED-HIST-";

function corteISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

type ProductoLean = {
  _id: unknown;
  nombre: string;
  categoria: string;
  unidad: "pieza" | "kg";
  requierePesaje: boolean;
  precioVenta: number;
};

async function run() {
  await connectDB();

  const [sucursales, productos] = await Promise.all([
    Sucursal.find({ activo: true }).lean(),
    Producto.find({ activo: true }).lean<ProductoLean[]>(),
  ]);

  if (sucursales.length === 0 || productos.length === 0) {
    console.error("No hay sucursales o productos en la base. Corre primero `npm run seed`.");
    process.exit(1);
  }

  await Pedido.deleteMany({ folio: { $regex: `^${PREFIJO_FOLIO}` } });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let creados = 0;

  for (let i = DIAS - 1; i >= 0; i--) {
    const fecha = new Date(hoy.getTime() - i * 86400000);
    const corte = corteISO(fecha);

    // Tendencia suave al alza a lo largo del mes, con variación diaria aleatoria,
    // para que el gráfico de ventas y la tendencia calculada tengan algo que mostrar.
    const progreso = (DIAS - 1 - i) / (DIAS - 1); // 0 (hace 30 días) -> 1 (hoy)
    const base = 2800 + progreso * 3200; // de ~$2,800/día a ~$6,000/día
    const ruido = 1 + (Math.random() - 0.5) * 0.4; // +/-20%
    const objetivo = Math.max(500, base * ruido);

    const sucursal = sucursales[i % sucursales.length];

    const items: {
      productoId: unknown;
      nombreProducto: string;
      categoria: string;
      unidad: "pieza" | "kg";
      requierePesaje: boolean;
      precioVenta: number;
      cantidadPedida: number;
      cantidadAsignada: number;
      cantidadSurtida: number;
      pesoSurtidoKg: number | null;
    }[] = [];
    let acumulado = 0;
    let intentos = 0;

    while (acumulado < objetivo && intentos < 15) {
      intentos++;
      const producto = productos[Math.floor(Math.random() * productos.length)];
      if (items.some((it) => it.productoId === producto._id)) continue;

      const cantidad = producto.unidad === "kg" ? Math.round((2 + Math.random() * 8) * 10) / 10 : Math.round(5 + Math.random() * 35);

      items.push({
        productoId: producto._id,
        nombreProducto: producto.nombre,
        categoria: producto.categoria,
        unidad: producto.unidad,
        requierePesaje: producto.requierePesaje,
        precioVenta: producto.precioVenta ?? 0,
        cantidadPedida: cantidad,
        cantidadAsignada: cantidad,
        cantidadSurtida: cantidad,
        pesoSurtidoKg: producto.requierePesaje ? cantidad : null,
      });

      acumulado += cantidad * (producto.precioVenta ?? 0);
    }

    if (items.length === 0) continue;

    await Pedido.create({
      folio: `${PREFIJO_FOLIO}${corte.replaceAll("-", "")}`,
      sucursalId: sucursal._id,
      fecha,
      corte,
      estado: i === 0 ? "surtido" : "recibido",
      items,
    });
    creados++;
  }

  console.log(`Listo: se crearon ${creados} pedidos históricos (${PREFIJO_FOLIO}*) de los últimos ${DIAS} días.`);
  console.log("Ve a Matriz > Dashboard para ver el gráfico de ventas con esta información.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
