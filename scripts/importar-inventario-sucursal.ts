import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { connectDB } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { parseCsvObjects } from "./lib/csv";
import Sucursal from "../src/models/Sucursal";
import UserModel from "../src/models/User";
import Producto from "../src/models/Producto";
import InventarioSucursal from "../src/models/InventarioSucursal";

// Uso: tsx scripts/importar-inventario-sucursal.ts --sucursal=<carpeta> [--dry-run]
// <carpeta> es el nombre de la carpeta bajo scripts/data/ (ej. "alcala", "coronado"),
// que debe contener sucursales.csv (1 fila) e inventario.csv con las columnas
// sucursal, sku, stock_actual, stock_minimo, stock_maximo.

const DRY_RUN = process.argv.includes("--dry-run");
const sucursalArg = process.argv.find((a) => a.startsWith("--sucursal="));
const CARPETA = sucursalArg?.split("=")[1];

if (!CARPETA) {
  console.error("Falta --sucursal=<carpeta> (ej. --sucursal=alcala). Carpeta esperada bajo scripts/data/.");
  process.exit(1);
}

const DATA_DIR = path.resolve(process.cwd(), "scripts/data", CARPETA);
const BATCH_SIZE = 1000;
const PASSWORD = "titos123";

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

function claveAEmail(clave: string) {
  return `${clave.toLowerCase()}@titos.com`;
}

async function importarSucursales(rows: Record<string, string>[]): Promise<Map<string, string>> {
  const existentes = new Map((await Sucursal.find().select("nombre").lean()).map((s) => [s.nombre, String(s._id)]));

  let creadas = 0;
  let actualizadas = 0;
  for (const r of rows) {
    const esNueva = !existentes.has(r.nombre);
    if (esNueva) creadas++;
    else actualizadas++;
    log(`sucursal | ${esNueva ? "crear" : "actualizar"} | ${r.clave} | ${r.nombre}`);

    if (!DRY_RUN) {
      await Sucursal.findOneAndUpdate(
        { nombre: r.nombre },
        { $set: { clave: r.clave }, $setOnInsert: { nombre: r.nombre, direccion: "", whatsapp: "", activo: true } },
        { upsert: true }
      );
    }
  }
  console.log(`Sucursales: ${creadas} nuevas, ${actualizadas} ya existentes (${rows.length} total)`);

  const nombreAId = DRY_RUN
    ? new Map(rows.map((r) => [r.nombre, existentes.get(r.nombre) ?? `dry-run:${r.nombre}`]))
    : new Map((await Sucursal.find().select("nombre").lean()).map((s) => [s.nombre, String(s._id)]));
  return nombreAId;
}

async function importarUsuarios(rows: Record<string, string>[], nombreAId: Map<string, string>) {
  for (const r of rows) {
    const email = claveAEmail(r.clave);
    const yaExiste = await UserModel.exists({ email });
    if (yaExiste) {
      log(`user | ya existe | ${email}`);
      console.log(`Usuario: ${email} ya existe, no se toca.`);
      continue;
    }

    log(`user | crear | ${email}`);
    console.log(`Usuario: creando ${email} (contraseña: ${PASSWORD})`);
    if (!DRY_RUN) {
      const passwordHash = await hashPassword(PASSWORD);
      await UserModel.create({
        email,
        passwordHash,
        nombre: `Encargado ${r.nombre}`,
        role: "sucursal",
        sucursalId: nombreAId.get(r.nombre),
      });
    }
  }
}

async function importarInventario(sucursalId: string, nombreSucursal: string) {
  const rows = readCsv("inventario.csv");
  const skuAProductoId = new Map((await Producto.find().select("sku").lean()).map((p) => [p.sku, String(p._id)]));

  const sucursalIdEsReal = /^[0-9a-fA-F]{24}$/.test(sucursalId);
  const existentesRaw = sucursalIdEsReal
    ? await InventarioSucursal.find({ sucursalId }).select("productoId").lean()
    : [];
  const existentes = new Set(existentesRaw.map((e) => String(e.productoId)));

  let creados = 0;
  let actualizados = 0;
  let omitidosSinSku = 0;
  const ops: Parameters<typeof InventarioSucursal.bulkWrite>[0] = [];

  for (const r of rows) {
    if (!r.sku) {
      omitidosSinSku++;
      log(`inventario | omitido (sin sku en matriz) | ${r.codigo_original} | ${r.nombre_referencia}`);
      continue;
    }
    const productoId = skuAProductoId.get(r.sku);
    if (!productoId) {
      omitidosSinSku++;
      log(`inventario | omitido (sku no encontrado en matriz) | ${r.sku} | ${r.nombre_referencia}`);
      continue;
    }

    const esNuevo = !existentes.has(productoId);
    if (esNuevo) {
      creados++;
      existentes.add(productoId);
    } else {
      actualizados++;
    }
    log(`inventario | ${esNuevo ? "crear" : "actualizar"} | ${r.sku} | ${r.nombre_referencia}`);

    ops.push({
      updateOne: {
        filter: { sucursalId, productoId },
        update: {
          $set: {
            stockActual: Number(r.stock_actual) || 0,
            stockMinimo: Number(r.stock_minimo) || 0,
            stockMaximo: Number(r.stock_maximo) || 0,
          },
        },
        upsert: true,
      },
    });
  }

  if (!DRY_RUN) {
    for (const batch of chunk(ops, BATCH_SIZE)) await InventarioSucursal.bulkWrite(batch, { ordered: false });
  }

  console.log(
    `Inventario ${nombreSucursal}: ${creados} nuevos, ${actualizados} ya existentes, ` +
      `${omitidosSinSku} omitidos (sin sku en matriz) (${rows.length} total)`
  );
}

async function main() {
  console.log(`Sucursal: ${CARPETA} | Modo: ${DRY_RUN ? "DRY RUN (no se escribe nada)" : "REAL"}`);
  await connectDB();
  console.log("Conectado a MongoDB.\n");

  const sucursalRows = readCsv("sucursales.csv");
  if (sucursalRows.length !== 1) {
    console.error(`Se esperaba exactamente 1 fila en sucursales.csv, se encontraron ${sucursalRows.length}.`);
    process.exit(1);
  }
  const nombreSucursal = sucursalRows[0].nombre;

  const nombreAId = await importarSucursales(sucursalRows);
  await importarUsuarios(sucursalRows, nombreAId);

  const sucursalId = nombreAId.get(nombreSucursal);
  if (!sucursalId) {
    console.error(`No se pudo resolver el _id de "${nombreSucursal}", abortando la carga de inventario.`);
    process.exit(1);
  }
  await importarInventario(sucursalId, nombreSucursal);

  if (!fs.existsSync(path.resolve(process.cwd(), "scripts/logs"))) {
    fs.mkdirSync(path.resolve(process.cwd(), "scripts/logs"), { recursive: true });
  }
  const logPath = path.resolve(process.cwd(), `scripts/logs/import-${CARPETA}-${Date.now()}.log`);
  fs.writeFileSync(logPath, logLines.join("\n") + "\n", "utf8");
  console.log(`\nLog detallado (${logLines.length} líneas) escrito en ${logPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
