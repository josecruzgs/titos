import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { connectDB } from "../src/lib/db";
import { parseCsvObjects } from "./lib/csv";
import CategoriaProducto from "../src/models/CategoriaProducto";
import LineaProducto from "../src/models/LineaProducto";
import Proveedor from "../src/models/Proveedor";
import Producto from "../src/models/Producto";
import ProductoProveedor from "../src/models/ProductoProveedor";

const DRY_RUN = process.argv.includes("--dry-run");
const DATA_DIR = path.resolve(process.cwd(), "scripts/data/cedis");
const BATCH_SIZE = 1000;

const logLines: string[] = [];
function log(line: string) {
  logLines.push(line);
}

function readCsv(name: string): Record<string, string>[] {
  const text = fs.readFileSync(path.join(DATA_DIR, name), "utf8");
  return parseCsvObjects(text);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function mapUnidad(raw: string): "pieza" | "kg" {
  return raw.trim().toLowerCase() === "kilogramo" ? "kg" : "pieza";
}

async function importarCategorias() {
  const rows = readCsv("02_categorias.csv");
  const existentes = new Set((await CategoriaProducto.find().select("nombre").lean()).map((c) => c.nombre));

  let creadas = 0;
  let actualizadas = 0;
  const ops = rows.map((r) => {
    if (existentes.has(r.nombre)) actualizadas++;
    else creadas++;
    log(`categoria | ${existentes.has(r.nombre) ? "actualizar" : "crear"} | ${r.nombre}`);
    return {
      updateOne: {
        filter: { nombre: r.nombre },
        update: { $set: { nombre: r.nombre }, $setOnInsert: { activo: true } },
        upsert: true,
      },
    };
  });

  if (!DRY_RUN) await CategoriaProducto.bulkWrite(ops, { ordered: false });
  console.log(`Categorías: ${creadas} nuevas, ${actualizadas} ya existentes (${rows.length} total)`);
}

async function importarLineas() {
  const rows = readCsv("01_lineas.csv");
  const existentes = new Set((await LineaProducto.find().select("nombre").lean()).map((l) => l.nombre));

  let creadas = 0;
  let actualizadas = 0;
  const ops = rows.map((r) => {
    if (existentes.has(r.nombre)) actualizadas++;
    else creadas++;
    log(`linea | ${existentes.has(r.nombre) ? "actualizar" : "crear"} | ${r.nombre}`);
    return {
      updateOne: {
        filter: { nombre: r.nombre },
        update: { $set: { nombre: r.nombre }, $setOnInsert: { activo: true } },
        upsert: true,
      },
    };
  });

  if (!DRY_RUN) await LineaProducto.bulkWrite(ops, { ordered: false });
  console.log(`Líneas: ${creadas} nuevas, ${actualizadas} ya existentes (${rows.length} total)`);
}

async function importarProveedores(): Promise<Map<string, string>> {
  const rows = readCsv("04_proveedores.csv");
  const existentes = new Map((await Proveedor.find().select("nombre").lean()).map((p) => [p.nombre, String(p._id)]));

  let creados = 0;
  let actualizados = 0;
  const ops = rows.map((r) => {
    if (existentes.has(r.nombre)) actualizados++;
    else creados++;
    log(`proveedor | ${existentes.has(r.nombre) ? "actualizar" : "crear"} | ${r.id_proveedor} | ${r.nombre}`);
    return {
      updateOne: {
        filter: { nombre: r.nombre },
        update: { $setOnInsert: { nombre: r.nombre, contacto: "", whatsapp: "", email: "", activo: true } },
        upsert: true,
      },
    };
  });

  if (!DRY_RUN) {
    for (const batch of chunk(ops, BATCH_SIZE)) await Proveedor.bulkWrite(batch, { ordered: false });
  }
  console.log(`Proveedores: ${creados} nuevos, ${actualizados} ya existentes (${rows.length} total)`);

  // id_proveedor (PROV-0001...) -> _id real de Mongo, resuelto por nombre.
  const idProveedorANombre = new Map(rows.map((r) => [r.id_proveedor, r.nombre]));
  const nombreAMongoId = DRY_RUN
    ? new Map(rows.map((r) => [r.nombre, existentes.get(r.nombre) ?? `dry-run:${r.nombre}`]))
    : new Map((await Proveedor.find().select("nombre").lean()).map((p) => [p.nombre, String(p._id)]));

  const mapa = new Map<string, string>();
  for (const [idProveedor, nombre] of idProveedorANombre) {
    const mongoId = nombreAMongoId.get(nombre);
    if (mongoId) mapa.set(idProveedor, mongoId);
  }
  return mapa;
}

async function importarProductos(): Promise<Map<string, string>> {
  const rows = readCsv("05_productos.csv");
  const existentes = new Map((await Producto.find().select("sku").lean()).map((p) => [p.sku, String(p._id)]));

  let creados = 0;
  let actualizados = 0;
  const ops = rows.map((r) => {
    const esNuevo = !existentes.has(r.sku);
    if (esNuevo) creados++;
    else actualizados++;
    log(`producto | ${esNuevo ? "crear" : "actualizar"} | ${r.sku} | ${r.nombre}`);

    // "anaquel" es opcional en el CSV: si la columna viene vacía o no existe no
    // se toca, para no borrar ubicaciones capturadas a mano desde la app.
    const anaquel = r.anaquel?.trim();

    return {
      updateOne: {
        filter: { sku: r.sku },
        update: {
          $set: {
            ...(anaquel ? { anaquel } : {}),
            nombre: r.nombre,
            linea: r.linea,
            categoria: r.categoria,
            unidad: mapUnidad(r.unidad),
            requierePesaje: r.requiere_pesaje.trim().toUpperCase() === "SI",
            precioCompra: Number(r.precio_compra) || 0,
            precioVenta: Number(r.precio_venta) || 0,
            existenciaMatriz: Number(r.existencia_inicial) || 0,
            stockMinimo: Number(r.stock_minimo) || 0,
            stockMaximo: Number(r.stock_maximo) || 0,
          },
          $setOnInsert: { activo: true },
        },
        upsert: true,
      },
    };
  });

  if (!DRY_RUN) {
    for (const batch of chunk(ops, BATCH_SIZE)) await Producto.bulkWrite(batch, { ordered: false });
  }
  console.log(`Productos: ${creados} nuevos, ${actualizados} ya existentes (${rows.length} total)`);

  const skuAMongoId = DRY_RUN
    ? new Map(rows.map((r) => [r.sku, existentes.get(r.sku) ?? `dry-run:${r.sku}`]))
    : new Map((await Producto.find().select("sku").lean()).map((p) => [p.sku, String(p._id)]));
  return skuAMongoId;
}

async function importarProductoProveedor(skuAId: Map<string, string>, idProveedorAId: Map<string, string>) {
  const rows = readCsv("06_producto_proveedor.csv");

  const existentesRaw = await ProductoProveedor.find().select("productoId proveedorId").lean();
  const existentes = new Set(existentesRaw.map((e) => `${e.productoId}:${e.proveedorId}`));

  let creados = 0;
  let actualizados = 0;
  let omitidosSinNombre = 0;
  let omitidosSinSku = 0;
  let omitidosSinProveedor = 0;
  const ops: Parameters<typeof ProductoProveedor.bulkWrite>[0] = [];

  for (const r of rows) {
    if (r.id_proveedor === "SIN-NOMBRE") {
      omitidosSinNombre++;
      log(`producto_proveedor | omitido (proveedor sin nombre) | ${r.sku}`);
      continue;
    }
    const productoId = skuAId.get(r.sku);
    if (!productoId) {
      omitidosSinSku++;
      log(`producto_proveedor | omitido (sku no encontrado) | ${r.sku} | ${r.id_proveedor}`);
      continue;
    }
    const proveedorId = idProveedorAId.get(r.id_proveedor);
    if (!proveedorId) {
      omitidosSinProveedor++;
      log(`producto_proveedor | omitido (proveedor no encontrado) | ${r.sku} | ${r.id_proveedor}`);
      continue;
    }

    const key = `${productoId}:${proveedorId}`;
    const esNuevo = !existentes.has(key);
    if (esNuevo) {
      creados++;
      existentes.add(key); // evita contar dos veces el mismo par si el CSV lo repite
    } else {
      actualizados++;
    }
    log(`producto_proveedor | ${esNuevo ? "crear" : "actualizar"} | ${r.sku} | ${r.proveedor}`);

    ops.push({
      updateOne: {
        filter: { productoId, proveedorId },
        update: {
          $set: {
            costo: Number(r.costo) || 0,
            ivaPct: Number(r.iva_pct) || 0,
            iepsPct: Number(r.ieps_pct) || 0,
            costoUnitario: Number(r.costo_unitario) || 0,
            esPrincipal: r.es_principal.trim().toUpperCase() === "SI",
            observaciones: r.observaciones || "",
          },
          $setOnInsert: { activo: true },
        },
        upsert: true,
      },
    });
  }

  if (!DRY_RUN) {
    for (const batch of chunk(ops, BATCH_SIZE)) await ProductoProveedor.bulkWrite(batch, { ordered: false });
  }

  console.log(
    `Producto-Proveedor: ${creados} nuevos, ${actualizados} ya existentes, ` +
      `${omitidosSinNombre} omitidos (sin nombre), ${omitidosSinSku} omitidos (sku no encontrado), ` +
      `${omitidosSinProveedor} omitidos (proveedor no encontrado) (${rows.length} total)`
  );
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? "DRY RUN (no se escribe nada)" : "REAL"}`);
  await connectDB();
  console.log("Conectado a MongoDB.\n");

  await importarCategorias();
  await importarLineas();
  const idProveedorAId = await importarProveedores();
  const skuAId = await importarProductos();
  await importarProductoProveedor(skuAId, idProveedorAId);

  if (!fs.existsSync(path.resolve(process.cwd(), "scripts/logs"))) {
    fs.mkdirSync(path.resolve(process.cwd(), "scripts/logs"), { recursive: true });
  }
  const logPath = path.resolve(process.cwd(), `scripts/logs/import-cedis-${Date.now()}.log`);
  fs.writeFileSync(logPath, logLines.join("\n") + "\n", "utf8");
  console.log(`\nLog detallado (${logLines.length} líneas) escrito en ${logPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
