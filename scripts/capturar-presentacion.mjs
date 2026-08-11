// Toma las capturas de pantalla que ilustran la presentación de avances.
// Uso: node scripts/capturar-presentacion.mjs
// Requiere el servidor de desarrollo corriendo en http://localhost:3000.
//
// Las credenciales se leen de variables de entorno para no dejarlas escritas
// en el repositorio:
//   PRESENTACION_MATRIZ_EMAIL / PRESENTACION_MATRIZ_PASSWORD
//   PRESENTACION_SUCURSAL_EMAIL / PRESENTACION_SUCURSAL_PASSWORD

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.PRESENTACION_BASE_URL ?? "http://localhost:3000";
const SALIDA = "public/presentacion/img";

const CUENTAS = {
  matriz: {
    email: process.env.PRESENTACION_MATRIZ_EMAIL,
    password: process.env.PRESENTACION_MATRIZ_PASSWORD,
  },
  sucursal: {
    email: process.env.PRESENTACION_SUCURSAL_EMAIL,
    password: process.env.PRESENTACION_SUCURSAL_PASSWORD,
  },
};

/** Oculta el indicador de compilación de Next para que no salga en las capturas. */
async function ocultarOverlayDev(page) {
  await page
    .addStyleTag({
      content: `nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button],
                #__next-build-watcher { display: none !important; }`,
    })
    .catch(() => {});
}

/**
 * Término de búsqueda tomado del catálogo real: la primera palabra de al menos
 * 4 letras, para que la búsqueda devuelva resultados y no una cadena cortada.
 */
async function terminoDeBusqueda(page) {
  const productos = await page.evaluate(async () => {
    const res = await fetch("/api/productos");
    if (!res.ok) return [];
    return res.json();
  });

  for (const producto of productos.slice(0, 40)) {
    const palabra = String(producto?.nombre ?? "")
      .split(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+/)
      .find((p) => p.length >= 4);
    if (palabra) return palabra;
  }
  return "";
}

// Acciones previas al screenshot. Todas son de solo lectura o puramente de
// interfaz: ninguna guarda nada en la base de datos.
const ACCIONES = {
  async abrirModalSucursal(page) {
    await page.getByRole("button", { name: /Ver \/ Editar/i }).first().click();
    await page.waitForTimeout(800);
  },

  async buscarStockOtrasSucursales(page) {
    const termino = await terminoDeBusqueda(page);
    if (!termino) return;
    await page.getByPlaceholder(/Nombre, SKU o alias/i).fill(termino);
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    // Espera a que pinten los resultados, no solo a que termine la petición.
    await page.getByText(/Tú tienes/).first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(500);
  },

  async pedirPrestado(page) {
    await ACCIONES.buscarStockOtrasSucursales(page);
    // El primer chip de sucursal con existencia abre el modal de solicitud.
    const chip = page.locator("button", { hasText: /Sucursal/ }).last();
    if ((await chip.count()) > 0) {
      await chip.click();
      await page.getByText(/Pedir prestado a/).first().waitFor({ timeout: 8000 });
      await page.waitForTimeout(500);
    }
  },

  async cobroConCredito(page) {
    const termino = await terminoDeBusqueda(page);
    if (!termino) return;

    await page.getByPlaceholder(/Buscar por nombre o SKU/i).fill(termino);
    // Las opciones del combobox se eligen con mousedown, no con el teclado.
    const opcion = page.locator("div.absolute.z-10 button").first();
    await opcion.waitFor({ timeout: 8000 });
    await opcion.click();
    await page.waitForTimeout(700);

    // Si el producto se vende por peso, el POS pide capturarlo antes de agregarlo.
    const modalPeso = page.getByText(/Capturar peso/).first();
    if (await modalPeso.isVisible().catch(() => false)) {
      await page.getByPlaceholder("0.00").first().fill("1.5").catch(() => {});
      await page.locator('input[type="number"]').first().fill("1.5").catch(() => {});
      await page.getByRole("button", { name: /Agregar al carrito/i }).click();
      await page.waitForTimeout(700);
    }

    await page.locator('button[title="Cobrar"]').click();
    await page.getByText(/Total a pagar/).first().waitFor({ timeout: 8000 });

    // Si la sucursal ya tiene clientes dados de alta, se elige uno para que la
    // captura muestre la ficha de crédito y el pago a crédito.
    const selectCliente = page.locator("select").first();
    const opciones = await selectCliente.locator("option").count().catch(() => 0);
    if (opciones > 1) {
      const valor = await selectCliente.locator("option").nth(1).getAttribute("value");
      if (valor) await selectCliente.selectOption(valor).catch(() => {});
      await page.waitForTimeout(600);
    }

    await page.waitForTimeout(400);
  },

  async altaCliente(page) {
    await page.getByRole("button", { name: /Nuevo cliente/i }).click();
    await page.waitForTimeout(800);
  },
};

/** Pantallas a capturar: [archivo, ruta, cuenta, accion?] */
const PANTALLAS = [
  ["matriz-dashboard", "/matriz", "matriz"],
  ["matriz-configuracion", "/matriz/configuracion", "matriz"],
  ["matriz-sucursales", "/matriz/sucursales", "matriz"],
  ["matriz-sucursal-zona-horaria", "/matriz/sucursales", "matriz", "abrirModalSucursal"],
  ["matriz-cortes", "/matriz/cortes", "matriz"],
  ["matriz-notas-de-venta", "/matriz/notas-de-venta", "matriz"],
  ["sucursal-punto-venta", "/sucursal", "sucursal"],
  ["sucursal-punto-venta-cobro", "/sucursal", "sucursal", "cobroConCredito"],
  ["sucursal-clientes", "/sucursal/clientes", "sucursal"],
  ["sucursal-cliente-alta", "/sucursal/clientes", "sucursal", "altaCliente"],
  ["sucursal-devoluciones", "/sucursal/devoluciones", "sucursal"],
  ["sucursal-prestamos", "/sucursal/prestamos", "sucursal"],
  ["sucursal-prestamos-stock", "/sucursal/prestamos", "sucursal", "buscarStockOtrasSucursales"],
  ["sucursal-prestamos-solicitar", "/sucursal/prestamos", "sucursal", "pedirPrestado"],
  ["sucursal-ventas", "/sucursal/ventas", "sucursal"],
];

async function iniciarSesion(page, cuenta) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  // Los inputs son controlados por React: si se llenan antes de que hidrate, la
  // hidratación los vuelve a vaciar y el submit se queda sin datos.
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const email = page.locator('input[type="email"]');
  const password = page.locator('input[type="password"]');

  await email.fill(cuenta.email);
  await password.fill(cuenta.password);

  // Verifica que React ya tomó los valores antes de enviar.
  if ((await email.inputValue()) !== cuenta.email) {
    await page.waitForTimeout(1500);
    await email.fill(cuenta.email);
    await password.fill(cuenta.password);
  }

  const respuesta = page.waitForResponse(
    (r) => r.url().includes("/api/auth/login") && r.request().method() === "POST",
    { timeout: 20000 }
  );
  await page.click('button[type="submit"]');

  const res = await respuesta;
  if (!res.ok()) throw new Error(`el login respondió ${res.status()}`);

  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
}

async function capturar(page, archivo, ruta, accion) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: "domcontentloaded" });
  // Deja que carguen los fetch del cliente (tablas, catálogos, resúmenes).
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await ocultarOverlayDev(page);

  if (accion) {
    try {
      await ACCIONES[accion](page);
    } catch (error) {
      console.log(`    (acción "${accion}" incompleta: ${error.message.split("\n")[0]})`);
    }
  }

  await ocultarOverlayDev(page);
  await page.screenshot({ path: `${SALIDA}/${archivo}.png`, fullPage: false });
  console.log(`  ✓ ${archivo}.png`);
}

async function main() {
  await mkdir(SALIDA, { recursive: true });

  const navegador = await chromium.launch();
  const resultados = { ok: [], fallidas: [] };

  for (const rol of ["matriz", "sucursal"]) {
    const cuenta = CUENTAS[rol];
    const pantallas = PANTALLAS.filter(([, , r]) => r === rol);

    if (!cuenta.email || !cuenta.password) {
      console.log(`\n⚠ Sin credenciales de ${rol}; se omiten ${pantallas.length} pantallas.`);
      resultados.fallidas.push(...pantallas.map(([a]) => `${a} (sin credenciales)`));
      continue;
    }

    const contexto = await navegador.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      locale: "es-MX",
    });
    const page = await contexto.newPage();

    try {
      console.log(`\nEntrando como ${rol} (${cuenta.email})...`);
      await iniciarSesion(page, cuenta);
      console.log("  sesión iniciada");
    } catch (error) {
      console.log(`  ✗ no se pudo entrar como ${rol}: ${error.message.split("\n")[0]}`);
      resultados.fallidas.push(...pantallas.map(([a]) => `${a} (login falló)`));
      await contexto.close();
      continue;
    }

    for (const [archivo, ruta, , accion] of pantallas) {
      try {
        await capturar(page, archivo, ruta, accion);
        resultados.ok.push(archivo);
      } catch (error) {
        console.log(`  ✗ ${archivo}: ${error.message.split("\n")[0]}`);
        resultados.fallidas.push(archivo);
      }
    }

    await contexto.close();
  }

  await navegador.close();

  console.log(`\nCapturas generadas: ${resultados.ok.length}`);
  if (resultados.fallidas.length > 0) {
    console.log(`No se pudieron capturar: ${resultados.fallidas.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
