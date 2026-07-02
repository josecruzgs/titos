import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { connectDB } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import UserModel from "../src/models/User";
import Sucursal from "../src/models/Sucursal";
import Producto from "../src/models/Producto";
import Pedido from "../src/models/Pedido";
import InventarioSucursal from "../src/models/InventarioSucursal";
import SolicitudProductoNuevo from "../src/models/SolicitudProductoNuevo";
import Proveedor from "../src/models/Proveedor";
import NecesidadCompra from "../src/models/NecesidadCompra";
import OrdenCompra from "../src/models/OrdenCompra";
import MovimientoInventario from "../src/models/MovimientoInventario";

const PASSWORD = "titos123";

async function seed() {
  await connectDB();
  console.log("Conectado a MongoDB. Limpiando datos de ejemplo previos...");

  await Promise.all([
    UserModel.deleteMany({}),
    Sucursal.deleteMany({}),
    Producto.deleteMany({}),
    Pedido.deleteMany({}),
    InventarioSucursal.deleteMany({}),
    SolicitudProductoNuevo.deleteMany({}),
    Proveedor.deleteMany({}),
    NecesidadCompra.deleteMany({}),
    OrdenCompra.deleteMany({}),
    MovimientoInventario.deleteMany({}),
  ]);

  const passwordHash = await hashPassword(PASSWORD);

  console.log("Creando usuario de matriz...");
  await UserModel.create({
    email: "matriz@titos.com",
    passwordHash,
    nombre: "Administrador Matriz",
    role: "matriz",
  });

  console.log("Creando sucursales...");
  const [centro, norte, sur] = await Promise.all([
    Sucursal.create({ nombre: "Titos Centro", direccion: "Av. Juárez 100, Centro" }),
    Sucursal.create({ nombre: "Titos Norte", direccion: "Blvd. Norte 250" }),
    Sucursal.create({ nombre: "Titos Sur", direccion: "Calz. del Sur 88" }),
  ]);

  await Promise.all([
    UserModel.create({
      email: "centro@titos.com",
      passwordHash,
      nombre: "Encargado Titos Centro",
      role: "sucursal",
      sucursalId: centro._id,
    }),
    UserModel.create({
      email: "norte@titos.com",
      passwordHash,
      nombre: "Encargado Titos Norte",
      role: "sucursal",
      sucursalId: norte._id,
    }),
    UserModel.create({
      email: "sur@titos.com",
      passwordHash,
      nombre: "Encargado Titos Sur",
      role: "sucursal",
      sucursalId: sur._id,
    }),
  ]);

  console.log("Creando proveedores...");
  await Promise.all([
    Proveedor.create({ nombre: "Distribuidora Central", contacto: "Laura Méndez", telefono: "55-1234-5678", email: "ventas@distribuidoracentral.com" }),
    Proveedor.create({ nombre: "Abarrotes del Valle", contacto: "Raúl Ibarra", telefono: "55-8765-4321", email: "pedidos@abarrotesdelvalle.com" }),
  ]);

  console.log("Creando catálogo de productos...");
  const productosData = [
    // Abarrotes
    { sku: "ABA-001", nombre: "Jabón en barra Zote", categoria: "limpieza", unidad: "pieza", existenciaMatriz: 10, stockMinimo: 20, precio: 18 },
    { sku: "ABA-002", nombre: "Arroz 1kg", categoria: "abarrotes", unidad: "pieza", existenciaMatriz: 120, stockMinimo: 30, precio: 24 },
    { sku: "ABA-003", nombre: "Frijol 1kg", categoria: "abarrotes", unidad: "pieza", existenciaMatriz: 95, stockMinimo: 30, precio: 32 },
    { sku: "ABA-004", nombre: "Aceite vegetal 1L", categoria: "abarrotes", unidad: "pieza", existenciaMatriz: 80, stockMinimo: 20, precio: 45 },
    { sku: "ABA-005", nombre: "Azúcar 1kg", categoria: "abarrotes", unidad: "pieza", existenciaMatriz: 110, stockMinimo: 25, precio: 22 },
    { sku: "ABA-006", nombre: "Sal 1kg", categoria: "abarrotes", unidad: "pieza", existenciaMatriz: 60, stockMinimo: 15, precio: 12 },
    { sku: "ABA-007", nombre: "Café soluble 200g", categoria: "abarrotes", unidad: "pieza", existenciaMatriz: 40, stockMinimo: 10, precio: 68 },
    { sku: "ABA-008", nombre: "Pasta para sopa 200g", categoria: "abarrotes", unidad: "pieza", existenciaMatriz: 70, stockMinimo: 15, precio: 15 },
    // Limpieza
    { sku: "LIM-001", nombre: "Detergente en polvo 1kg", categoria: "limpieza", unidad: "pieza", existenciaMatriz: 55, stockMinimo: 15, precio: 38 },
    { sku: "LIM-002", nombre: "Cloro 1L", categoria: "limpieza", unidad: "pieza", existenciaMatriz: 65, stockMinimo: 15, precio: 20 },
    { sku: "LIM-003", nombre: "Papel higiénico 4 rollos", categoria: "limpieza", unidad: "pieza", existenciaMatriz: 90, stockMinimo: 20, precio: 42 },
    { sku: "LIM-004", nombre: "Servilletas paquete", categoria: "limpieza", unidad: "pieza", existenciaMatriz: 75, stockMinimo: 15, precio: 18 },
    // Frutas y verduras (requieren pesaje)
    { sku: "FRV-001", nombre: "Jitomate", categoria: "frutas_verduras", unidad: "kg", existenciaMatriz: 180, stockMinimo: 40, requierePesaje: true, precio: 22 },
    { sku: "FRV-002", nombre: "Cebolla blanca", categoria: "frutas_verduras", unidad: "kg", existenciaMatriz: 150, stockMinimo: 30, requierePesaje: true, precio: 18 },
    { sku: "FRV-003", nombre: "Papa", categoria: "frutas_verduras", unidad: "kg", existenciaMatriz: 200, stockMinimo: 40, requierePesaje: true, precio: 16 },
    { sku: "FRV-004", nombre: "Plátano", categoria: "frutas_verduras", unidad: "kg", existenciaMatriz: 15, stockMinimo: 35, requierePesaje: true, precio: 14 },
    { sku: "FRV-005", nombre: "Manzana", categoria: "frutas_verduras", unidad: "kg", existenciaMatriz: 90, stockMinimo: 25, requierePesaje: true, precio: 32 },
    { sku: "FRV-006", nombre: "Limón", categoria: "frutas_verduras", unidad: "kg", existenciaMatriz: 70, stockMinimo: 20, requierePesaje: true, precio: 20 },
    { sku: "FRV-007", nombre: "Aguacate", categoria: "frutas_verduras", unidad: "kg", existenciaMatriz: 60, stockMinimo: 20, requierePesaje: true, precio: 45 },
    // Carnicería (requieren pesaje)
    { sku: "CAR-001", nombre: "Bistec de res", categoria: "carniceria", unidad: "kg", existenciaMatriz: 45, stockMinimo: 15, requierePesaje: true, precio: 165 },
    { sku: "CAR-002", nombre: "Pechuga de pollo", categoria: "carniceria", unidad: "kg", existenciaMatriz: 55, stockMinimo: 20, requierePesaje: true, precio: 89 },
    { sku: "CAR-003", nombre: "Chuleta de cerdo", categoria: "carniceria", unidad: "kg", existenciaMatriz: 35, stockMinimo: 15, requierePesaje: true, precio: 98 },
    { sku: "CAR-004", nombre: "Chorizo", categoria: "carniceria", unidad: "kg", existenciaMatriz: 25, stockMinimo: 10, requierePesaje: true, precio: 110 },
    // Lácteos
    { sku: "LAC-001", nombre: "Leche entera 1L", categoria: "lacteos", unidad: "pieza", existenciaMatriz: 140, stockMinimo: 30, precio: 26 },
    { sku: "LAC-002", nombre: "Queso panela 400g", categoria: "lacteos", unidad: "pieza", existenciaMatriz: 50, stockMinimo: 15, precio: 58 },
    { sku: "LAC-003", nombre: "Yogurt natural 1L", categoria: "lacteos", unidad: "pieza", existenciaMatriz: 45, stockMinimo: 15, precio: 34 },
    { sku: "LAC-004", nombre: "Crema ácida 200g", categoria: "lacteos", unidad: "pieza", existenciaMatriz: 38, stockMinimo: 10, precio: 28 },
    // Panadería
    { sku: "PAN-001", nombre: "Pan blanco de caja", categoria: "panaderia", unidad: "pieza", existenciaMatriz: 60, stockMinimo: 15, precio: 36 },
    { sku: "PAN-002", nombre: "Bolillo (docena)", categoria: "panaderia", unidad: "pieza", existenciaMatriz: 40, stockMinimo: 10, precio: 24 },
    // Bebidas
    { sku: "BEB-001", nombre: "Refresco de cola 2L", categoria: "bebidas", unidad: "pieza", existenciaMatriz: 100, stockMinimo: 25, precio: 32 },
    { sku: "BEB-002", nombre: "Agua embotellada 1L", categoria: "bebidas", unidad: "pieza", existenciaMatriz: 130, stockMinimo: 30, precio: 14 },
    { sku: "BEB-003", nombre: "Jugo de naranja 1L", categoria: "bebidas", unidad: "pieza", existenciaMatriz: 50, stockMinimo: 15, precio: 29 },
  ] as const;

  const productos = await Producto.insertMany(
    productosData.map((p) => ({ ...p, requierePesaje: "requierePesaje" in p ? p.requierePesaje : false, activo: true }))
  );

  const porSku = new Map(productos.map((p) => [p.sku, p]));

  console.log("Creando pedidos de ejemplo (incluye escasez para el Nivelador)...");
  const hoy = new Date().toISOString().slice(0, 10);

  // Ejemplo exacto del dueño: 10 piezas de Jabón Zote en almacén,
  // sucursal Centro pide 7, Norte pide 5, Sur pide 4 -> el Nivelador debe repartir 4/3/3.
  const jabon = porSku.get("ABA-001")!;
  const platano = porSku.get("FRV-004")!;
  const arroz = porSku.get("ABA-002")!;

  async function crearPedido(sucursalId: string, folioSuffix: string, items: { producto: typeof jabon; cantidad: number }[]) {
    return Pedido.create({
      folio: `PED-DEMO-${folioSuffix}`,
      sucursalId,
      fecha: new Date(),
      corte: hoy,
      estado: "pendiente",
      items: items.map((i) => ({
        productoId: i.producto._id,
        nombreProducto: i.producto.nombre,
        unidad: i.producto.unidad,
        requierePesaje: i.producto.requierePesaje,
        cantidadPedida: i.cantidad,
      })),
    });
  }

  await crearPedido(String(centro._id), "CEN01", [
    { producto: jabon, cantidad: 7 },
    { producto: arroz, cantidad: 20 },
    { producto: platano, cantidad: 8 },
  ]);
  await crearPedido(String(norte._id), "NOR01", [
    { producto: jabon, cantidad: 5 },
    { producto: arroz, cantidad: 15 },
    { producto: platano, cantidad: 6 },
  ]);
  await crearPedido(String(sur._id), "SUR01", [
    { producto: jabon, cantidad: 4 },
    { producto: arroz, cantidad: 10 },
    { producto: platano, cantidad: 5 },
  ]);

  console.log("Creando una solicitud de producto nuevo de ejemplo...");
  await SolicitudProductoNuevo.create({
    sucursalId: centro._id,
    pedidoId: null,
    nombreSugerido: "Detergente líquido XYZ 5L",
    descripcion: "Los clientes lo han pedido varias veces y no lo manejamos",
    unidad: "pieza",
    cantidadSugerida: 12,
  });

  console.log("\nListo. Usuarios de prueba (contraseña para todos: titos123):");
  console.log("  Matriz:        matriz@titos.com");
  console.log("  Titos Centro:  centro@titos.com");
  console.log("  Titos Norte:   norte@titos.com");
  console.log("  Titos Sur:     sur@titos.com");
  console.log("\nTip: en Matriz > Pedidos, ejecuta el Nivelador y observa cómo reparte");
  console.log("las 10 piezas de 'Jabón en barra Zote' entre Centro (7), Norte (5) y Sur (4).");

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
