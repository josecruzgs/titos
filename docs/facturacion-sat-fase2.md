# Fase 2 — Timbrado de facturas ante el SAT

Propuesta para convertir las facturas que hoy genera el sistema en CFDI 4.0 timbrados
y válidos ante el SAT.

## 1. Qué ya está resuelto (fase 1, implementada)

El módulo `/matriz/facturas` convierte una venta del punto de venta en una factura del
sistema. Cada factura ya guarda **todo lo que exige el CFDI 4.0**:

| Dato del CFDI | Dónde vive hoy |
| --- | --- |
| RFC, razón social, régimen fiscal y CP del receptor | `Factura.receptor` |
| Uso de CFDI | `Factura.receptor.usoCfdi` |
| Forma de pago SAT (01, 03, 04, 99) | `Factura.formaPago`, derivada de los pagos de la venta |
| Método de pago (PUE / PPD) | `Factura.metodoPago`, PPD si hubo crédito |
| Conceptos con clave de producto/servicio y clave de unidad | `Factura.conceptos[]` |
| Subtotal, IVA desglosado y total | `Factura.subtotal / iva / total` |
| Bitácora de comentarios | `Factura.comentarios[]` |
| Espacio reservado para el timbre | `Factura.timbrado` (`estado`, `uuid`, `fechaTimbrado`, `proveedor`, `error`) |

El bloque `timbrado` ya existe en el modelo justamente para que la fase 2 no obligue a
migrar datos: solo se llena.

**Lo único que falta** para que sean CFDI reales: sellarlas con el CSD de la empresa y
enviarlas a un PAC para que las certifique y devuelva el UUID (folio fiscal).

## 2. Lo que la empresa tiene que conseguir

Esto no es desarrollo, es trámite. Sin ello no se puede timbrar aunque el código esté listo.

1. **e.firma (FIEL) vigente** de la empresa emisora.
2. **CSD (Certificado de Sello Digital)** — se tramita en el portal del SAT con la e.firma.
   Son dos archivos (`.cer` y `.key`) más su contraseña. Es el sello con el que se firma
   cada factura. Vigencia de 4 años.
3. **Contrato con un PAC** (Proveedor Autorizado de Certificación). Es quien tiene permiso
   del SAT para certificar los CFDI.
4. **Definir series y folios** de facturación (hoy el sistema usa serie `A` y un folio propio;
   habrá que fijar la numeración fiscal formal).
5. **Confirmar la tasa de IVA por producto.** Hoy la tasa se configura global en
   `/matriz/configuracion` (por default 0%, que es lo correcto para la mayoría del
   abarrote). Para timbrar hay que marcar producto por producto cuál es tasa 0%, cuál
   16% y cuál exento — el SAT lo valida.

## 3. Proveedores (PAC) y costos

Precios de referencia del mercado mexicano. **Hay que pedir cotización formal**: los PAC
manejan descuentos por volumen y los precios cambian.

| Proveedor | Modelo de cobro | Costo aproximado por timbre | Notas |
| --- | --- | --- | --- |
| **Facturama** | Paquetes de folios prepagados | ~$1.00 – $2.50 MXN | API REST muy documentada, sandbox gratis. La opción más rápida de integrar. |
| **SW Sapien (Smarter Web)** | Paquetes de folios | ~$0.80 – $2.00 MXN | Muy usado por ERPs; SDK en varios lenguajes y buen soporte técnico. |
| **Finkok** | Paquetes de folios | ~$0.50 – $1.50 MXN | De los más baratos por volumen; API SOAP (un poco más áspera de integrar). |
| **Solución Factible** | Paquetes de folios | ~$1.00 – $2.00 MXN | Estable, con timbrado y cancelación en el mismo servicio. |
| **Facturapi** | Suscripción mensual + timbres | Desde ~$500 MXN/mes | El más cómodo para desarrollar (maneja catálogos y PDF), pero el más caro en fijo. |

Los folios **no caducan** en la mayoría de los PAC y se compran por paquete
(1,000 / 5,000 / 10,000). A mayor paquete, menor costo unitario.

### Estimación de costo mensual

| Facturas al mes | Costo estimado de timbrado |
| --- | --- |
| 100 | $100 – $250 MXN |
| 500 | $400 – $1,000 MXN |
| 2,000 | $1,200 – $3,000 MXN |

A esto hay que sumar:
- **Cancelaciones**: la mayoría de los PAC no las cobran aparte, pero conviene confirmarlo.
- **Consultas de estatus** ante el SAT: normalmente incluidas.

**Recomendación:** empezar con **Facturama** o **SW Sapien** por un paquete de 1,000
folios. La inversión inicial es de ~$1,500 – $2,500 MXN y permite validar todo el flujo
sin comprometerse a una mensualidad.

## 4. Qué hay que desarrollar

Trabajo estimado: **2 a 3 semanas** una vez que se tengan el CSD y el contrato del PAC.

1. **Almacenamiento seguro del CSD.** Los archivos `.cer` / `.key` y su contraseña no
   pueden vivir en la base de datos ni en el repositorio. Van en variables de entorno o
   en un almacén de secretos, y la contraseña siempre cifrada.
2. **Marcar el régimen fiscal del emisor** y su código postal (datos de la empresa, hoy
   no capturados en `Configuracion`).
3. **Tasa de IVA por producto** (campo nuevo en `Producto`: `tasaIva` / `exento`), que
   sustituya a la tasa global.
4. **Servicio de timbrado** (`src/lib/pac.ts`): arma el XML del CFDI 4.0 a partir de la
   `Factura`, lo manda al PAC y guarda en `Factura.timbrado` el UUID, la fecha, el XML
   timbrado y el sello. Si falla, guarda el error para reintentar.
5. **Guardar el XML timbrado.** Es el documento con valor fiscal; el PDF es solo su
   representación impresa. Hay que conservarlo 5 años.
6. **PDF con formato fiscal**: agregar al PDF actual el UUID, el sello digital del CFDI,
   el sello del SAT, la cadena original del complemento y el **código QR** de verificación.
7. **Cancelación ante el SAT**: hoy `cancelar` solo marca la factura en el sistema. Con
   timbrado hay que mandar la petición al SAT con su motivo de cancelación (01 a 04) y,
   en el motivo 01, el UUID que sustituye a la factura.
8. **Envío por correo** de XML + PDF al `emailFacturacion` del receptor.
9. **Validación de RFC contra la LCO** (lista de contribuyentes obligados) antes de
   timbrar: evita rechazos del PAC por RFC inexistente.

## 5. Orden sugerido

1. Contratar PAC y tramitar el CSD (trámite, en paralelo al desarrollo).
2. Integrar el **sandbox** del PAC y timbrar facturas de prueba.
3. Capturar los datos fiscales del emisor y las tasas de IVA por producto.
4. Pasar a producción con un lote pequeño de facturas reales.
5. Habilitar cancelación ante el SAT y envío por correo.

## 6. Riesgo principal

El error más caro es **timbrar con datos mal capturados**: un CFDI timbrado ya no se
edita, se cancela y se vuelve a emitir, y las cancelaciones fuera del mes en curso
requieren aceptación del receptor. Por eso conviene mantener el paso actual —generar
primero la factura del sistema, revisarla, y timbrar como acción aparte— en vez de
timbrar automáticamente al cerrar la venta.
