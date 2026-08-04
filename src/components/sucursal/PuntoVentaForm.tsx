"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScanLine,
  Trash2,
  Receipt,
  Search,
  Banknote,
  ClipboardCheck,
  WifiOff,
  RefreshCw,
  ShoppingCart,
  X,
  DollarSign,
  Wifi,
} from "lucide-react";
import { Button, Card, Input, Modal, FormField, formatMoney } from "@/components/ui";
import { ProductoCombobox } from "@/components/ProductoCombobox";
import {
  leerProductosCache,
  guardarProductosCache,
  leerInventarioCache,
  guardarInventarioCache,
  leerSesionCache,
  guardarSesionCache,
  leerCola,
  agregarACola,
  quitarDeCola,
  generarIdLocal,
  generarFolioLocal,
  type VentaPayload,
} from "@/lib/offlinePos";

type Producto = {
  _id: string;
  sku: string;
  nombre: string;
  alias?: string[];
  unidad: "pieza" | "kg";
  precioVenta: number;
  requierePesaje: boolean;
};

type LineaVenta = {
  productoId: string;
  sku: string;
  nombre: string;
  unidad: "pieza" | "kg";
  precioUnitario: number;
  cantidad: string;
};

type MetodoPago = "efectivo" | "tarjeta" | "transferencia";

const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

const TIPO_CAMBIO_CACHE_KEY = "titos-pos-tipo-cambio";

type VentaItemResp = { nombreProducto: string; cantidad: number; unidad: string; precioUnitario: number; subtotal: number };
type PagoResp = { metodoPago: MetodoPago; monto: number };
type VentaResp = {
  folio: string;
  items: VentaItemResp[];
  total: number;
  pagos: PagoResp[];
  montoRecibido: number | null;
  cambio: number | null;
  esVentas2?: boolean;
  ventas2SecuenciaEfectivo?: number | null;
  offline?: boolean;
};

type SesionCaja = {
  _id: string;
  efectivoInicial: number;
  fechaApertura: string;
  usuarioAperturaId?: { nombre?: string } | string | null;
  offline?: boolean;
};

type ResumenCaja = {
  sesion: SesionCaja;
  cantidadVentas: number;
  cantidadRetiros: number;
  totalVentasEfectivo: number;
  totalVentasTarjeta: number;
  totalVentasTransferencia: number;
  totalRetiros: number;
  efectivoEsperado: number;
};

function nombreCajero(sesion: SesionCaja | null) {
  if (!sesion || !sesion.usuarioAperturaId || typeof sesion.usuarioAperturaId === "string") return null;
  return sesion.usuarioAperturaId.nombre ?? null;
}

function formatDolares(value: number) {
  return `$${value.toFixed(2)}`;
}

export function PuntoVentaForm({ sucursalNombre = "" }: { sucursalNombre?: string }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [inventario, setInventario] = useState<Map<string, number>>(new Map());
  const [codigo, setCodigo] = useState("");
  const [carrito, setCarrito] = useState<LineaVenta[]>([]);
  const [busquedaId, setBusquedaId] = useState("");
  const [pesaje, setPesaje] = useState<Producto | null>(null);
  const [pesoInput, setPesoInput] = useState("");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoTarjeta, setMontoTarjeta] = useState("");
  const [montoTransferencia, setMontoTransferencia] = useState("");
  const [efectivoRecibido, setEfectivoRecibido] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [ventaCompletada, setVentaCompletada] = useState<VentaResp | null>(null);
  const [tipoCambio, setTipoCambio] = useState(0);
  const [modalCobro, setModalCobro] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Caja: apertura, retiro de efectivo y corte ---
  const [sesion, setSesion] = useState<SesionCaja | null | undefined>(undefined);
  const [efectivoInicialInput, setEfectivoInicialInput] = useState("");
  const [abriendoCaja, setAbriendoCaja] = useState(false);
  const [errorCaja, setErrorCaja] = useState<string | null>(null);

  const [modalRetiro, setModalRetiro] = useState(false);
  const [retiroMonto, setRetiroMonto] = useState("");
  const [retiroMotivo, setRetiroMotivo] = useState("");
  const [retirando, setRetirando] = useState(false);
  const [errorRetiro, setErrorRetiro] = useState<string | null>(null);

  const [modalCorte, setModalCorte] = useState(false);
  const [resumenCorte, setResumenCorte] = useState<ResumenCaja | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [efectivoContado, setEfectivoContado] = useState("");
  const [notasCorte, setNotasCorte] = useState("");
  const [cerrandoCaja, setCerrandoCaja] = useState(false);
  const [errorCorte, setErrorCorte] = useState<string | null>(null);
  const [corteCerrado, setCorteCerrado] = useState<{ efectivoEsperado: number; efectivoContado: number; diferencia: number } | null>(
    null
  );

  const [modalPrecio, setModalPrecio] = useState(false);
  const [precioCodigo, setPrecioCodigo] = useState("");
  const [precioResultado, setPrecioResultado] = useState<Producto | null | undefined>(undefined);

  // --- Modo sin conexión: cache local + cola de acciones pendientes ---
  const [isOnline, setIsOnline] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [erroresSync, setErroresSync] = useState<string[]>([]);
  const sincronizandoRef = useRef(false);

  const sincronizarCola = useCallback(async () => {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    setSincronizando(true);

    const erroresNuevos: string[] = [];
    while (true) {
      const cola = leerCola();
      if (cola.length === 0) break;
      const accion = cola[0];
      let sinConexion = false;

      try {
        if (accion.tipo === "venta") {
          const res = await fetch("/api/ventas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(accion.payload),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            erroresNuevos.push(`Venta pendiente: ${data.error || "no se pudo sincronizar"}`);
          }
        } else if (accion.tipo === "abrir_caja") {
          const res = await fetch("/api/caja/abrir", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(accion.payload),
          });
          if (res.ok) {
            const data = await res.json();
            setSesion(data);
            guardarSesionCache(data);
          } else {
            const data = await res.json().catch(() => ({}));
            erroresNuevos.push(`Apertura de caja: ${data.error || "no se pudo sincronizar"}`);
          }
        } else {
          const res = await fetch("/api/caja/retiros", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(accion.payload),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            erroresNuevos.push(`Retiro pendiente: ${data.error || "no se pudo sincronizar"}`);
          }
        }
      } catch {
        sinConexion = true;
      }

      if (sinConexion) break;
      quitarDeCola(accion.id);
      setPendientes(leerCola().length);
    }

    if (erroresNuevos.length > 0) setErroresSync((prev) => [...prev, ...erroresNuevos]);
    setSincronizando(false);
    sincronizandoRef.current = false;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee el estado real de conexión/cola al montar (no existe en el servidor)
    setIsOnline(navigator.onLine);
    setPendientes(leerCola().length);

    function handleOnline() {
      setIsOnline(true);
      sincronizarCola();
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [sincronizarCola]);

  useEffect(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then((data) => {
        setProductos(data);
        guardarProductosCache(data);
      })
      .catch(() => setProductos(leerProductosCache<Producto[]>([])));

    fetch("/api/inventario-sucursal")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http-error"))))
      .then((rows: { productoId: string; stockActual: number }[]) => {
        const obj = Object.fromEntries(rows.map((r) => [r.productoId, r.stockActual]));
        setInventario(new Map(Object.entries(obj)));
        guardarInventarioCache(obj);
      })
      .catch(() => setInventario(new Map(Object.entries(leerInventarioCache()))));

    fetch("/api/configuracion")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http-error"))))
      .then((data: { tipoCambio?: number }) => {
        const valor = Number(data.tipoCambio) || 0;
        setTipoCambio(valor);
        try {
          localStorage.setItem(TIPO_CAMBIO_CACHE_KEY, String(valor));
        } catch {}
      })
      .catch(() => {
        try {
          setTipoCambio(Number(localStorage.getItem(TIPO_CAMBIO_CACHE_KEY)) || 0);
        } catch {}
      });

    fetch("/api/caja/actual")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http-error"))))
      .then((data) => {
        setSesion(data);
        guardarSesionCache(data);
      })
      .catch(() => setSesion(leerSesionCache<SesionCaja>()))
      .finally(() => {
        if (leerCola().length > 0) sincronizarCola();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe ejecutarse al montar
  }, []);

  useEffect(() => {
    if (!pesaje && !ventaCompletada && !modalRetiro && !modalCorte && !modalPrecio && !modalCobro) inputRef.current?.focus();
  }, [pesaje, ventaCompletada, modalRetiro, modalCorte, modalPrecio, modalCobro, carrito]);

  const cargarResumenCorte = useCallback(async () => {
    if (!navigator.onLine) {
      setErrorCorte("Necesitas conexión a internet para hacer el corte de caja.");
      return;
    }
    setCargandoResumen(true);
    setErrorCorte(null);
    try {
      const res = await fetch("/api/caja/actual/resumen");
      if (!res.ok) {
        setErrorCorte("No se pudo calcular el resumen de la caja");
        return;
      }
      setResumenCorte(await res.json());
    } catch {
      setErrorCorte("Necesitas conexión a internet para hacer el corte de caja.");
    } finally {
      setCargandoResumen(false);
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "c") {
        e.preventDefault();
        setPrecioCodigo("");
        setPrecioResultado(undefined);
        setModalPrecio(true);
      } else if (key === "r" && sesion) {
        e.preventDefault();
        setErrorRetiro(null);
        setRetiroMonto("");
        setRetiroMotivo("");
        setModalRetiro(true);
      } else if (key === "t" && sesion) {
        e.preventDefault();
        setEfectivoContado("");
        setNotasCorte("");
        setCorteCerrado(null);
        setModalCorte(true);
        cargarResumenCorte();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sesion, cargarResumenCorte]);

  const total = useMemo(
    () => carrito.reduce((sum, l) => sum + (Number(l.cantidad) || 0) * l.precioUnitario, 0),
    [carrito]
  );

  const totalDolares = tipoCambio > 0 ? total / tipoCambio : null;

  const nEfectivo = Number(montoEfectivo) || 0;
  const nTarjeta = Number(montoTarjeta) || 0;
  const nTransferencia = Number(montoTransferencia) || 0;
  const sumaPagos = nEfectivo + nTarjeta + nTransferencia;
  const restante = Number((total - sumaPagos).toFixed(2));

  const cambio = nEfectivo > 0 ? (Number(efectivoRecibido) || 0) - nEfectivo : null;

  const carritoValido = carrito.length > 0 && carrito.every((l) => Number(l.cantidad) > 0);

  const puedeCobrar =
    carritoValido &&
    Math.abs(restante) < 0.01 &&
    sumaPagos > 0 &&
    (nEfectivo <= 0 || (Number(efectivoRecibido) || 0) >= nEfectivo);

  function completarCon(metodo: MetodoPago) {
    const otros =
      total - (metodo === "efectivo" ? 0 : nEfectivo) - (metodo === "tarjeta" ? 0 : nTarjeta) - (metodo === "transferencia" ? 0 : nTransferencia);
    const valor = Math.max(0, Number(otros.toFixed(2)));
    if (metodo === "efectivo") setMontoEfectivo(valor ? String(valor) : "");
    else if (metodo === "tarjeta") setMontoTarjeta(valor ? String(valor) : "");
    else setMontoTransferencia(valor ? String(valor) : "");
  }

  function agregarAlCarrito(producto: Producto, cantidad: number) {
    setCarrito((prev) => {
      const existente = prev.find((l) => l.productoId === producto._id);
      if (existente) {
        return prev.map((l) =>
          l.productoId === producto._id ? { ...l, cantidad: String((Number(l.cantidad) || 0) + cantidad) } : l
        );
      }
      return [
        ...prev,
        {
          productoId: producto._id,
          sku: producto.sku,
          nombre: producto.nombre,
          unidad: producto.unidad,
          precioUnitario: producto.precioVenta,
          cantidad: String(cantidad),
        },
      ];
    });
  }

  function buscarPorCodigo(codigo: string) {
    return productos.find((p) => p.sku.trim().toLowerCase() === codigo.trim().toLowerCase());
  }

  function procesarCodigo(e: React.FormEvent) {
    e.preventDefault();
    const valor = codigo.trim();
    setCodigo("");
    if (!valor) return;

    const producto = buscarPorCodigo(valor);
    if (!producto) {
      setError(`No se encontró ningún producto con el código "${valor}"`);
      return;
    }
    setError(null);

    if (producto.requierePesaje) {
      setPesaje(producto);
      setPesoInput("");
      return;
    }
    agregarAlCarrito(producto, 1);
  }

  function confirmarPesaje() {
    if (!pesaje) return;
    const peso = Number(pesoInput);
    if (!peso || peso <= 0) return;
    agregarAlCarrito(pesaje, peso);
    setPesaje(null);
    setPesoInput("");
  }

  function agregarPorBusqueda(productoId: string) {
    const producto = productos.find((p) => p._id === productoId);
    setBusquedaId("");
    if (!producto) return;
    if (producto.requierePesaje) {
      setPesaje(producto);
      setPesoInput("");
      return;
    }
    agregarAlCarrito(producto, 1);
  }

  function actualizarCantidad(productoId: string, cantidad: string) {
    setCarrito((prev) => prev.map((l) => (l.productoId === productoId ? { ...l, cantidad } : l)));
  }

  function quitarLinea(productoId: string) {
    setCarrito((prev) => prev.filter((l) => l.productoId !== productoId));
  }

  function aplicarDescuentoInventario() {
    setInventario((prev) => {
      const next = new Map(prev);
      for (const l of carrito) {
        const stock = next.get(l.productoId);
        if (stock != null) next.set(l.productoId, stock - (Number(l.cantidad) || 0));
      }
      guardarInventarioCache(Object.fromEntries(next));
      return next;
    });
  }

  function limpiarCarritoYPago() {
    setCarrito([]);
    setMontoEfectivo("");
    setMontoTarjeta("");
    setMontoTransferencia("");
    setEfectivoRecibido("");
  }

  function cancelarVenta() {
    limpiarCarritoYPago();
    setError(null);
  }

  function abrirCobro() {
    if (!carritoValido) return;
    setError(null);
    setModalCobro(true);
  }

  function registrarVentaOffline(payload: VentaPayload) {
    agregarACola({ id: generarIdLocal(), tipo: "venta", creadaEn: new Date().toISOString(), payload });
    setPendientes(leerCola().length);

    const pagoEfectivo = payload.pagos.find((p) => p.metodoPago === "efectivo");
    const ventaLocal: VentaResp = {
      folio: generarFolioLocal(),
      items: carrito.map((l) => ({
        nombreProducto: l.nombre,
        cantidad: Number(l.cantidad) || 0,
        unidad: l.unidad,
        precioUnitario: l.precioUnitario,
        subtotal: (Number(l.cantidad) || 0) * l.precioUnitario,
      })),
      total,
      pagos: payload.pagos,
      montoRecibido: payload.montoRecibido ?? null,
      cambio:
        pagoEfectivo && payload.montoRecibido != null
          ? Number((payload.montoRecibido - pagoEfectivo.monto).toFixed(2))
          : null,
      esVentas2: false,
      offline: true,
    };

    aplicarDescuentoInventario();
    setModalCobro(false);
    setVentaCompletada(ventaLocal);
    limpiarCarritoYPago();
  }

  async function cobrar() {
    if (!puedeCobrar) return;
    setError(null);

    const pagos: PagoResp[] = [
      ...(nEfectivo > 0 ? [{ metodoPago: "efectivo" as const, monto: nEfectivo }] : []),
      ...(nTarjeta > 0 ? [{ metodoPago: "tarjeta" as const, monto: nTarjeta }] : []),
      ...(nTransferencia > 0 ? [{ metodoPago: "transferencia" as const, monto: nTransferencia }] : []),
    ];
    const payload: VentaPayload = {
      items: carrito.map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad) })),
      pagos,
      montoRecibido: nEfectivo > 0 ? Number(efectivoRecibido) : undefined,
    };

    if (!isOnline) {
      registrarVentaOffline(payload);
      return;
    }

    setProcesando(true);
    try {
      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo registrar la venta");
        return;
      }

      const venta: VentaResp = await res.json();
      aplicarDescuentoInventario();
      setModalCobro(false);
      setVentaCompletada(venta);
      limpiarCarritoYPago();
    } catch {
      // se perdió la conexión justo al cobrar: no se pierde la venta, se guarda para sincronizar después
      registrarVentaOffline(payload);
    } finally {
      setProcesando(false);
    }
  }

  function nuevaVenta() {
    setVentaCompletada(null);
  }

  function abrirCajaOffline(efectivoInicial: number) {
    agregarACola({ id: generarIdLocal(), tipo: "abrir_caja", creadaEn: new Date().toISOString(), payload: { efectivoInicial } });
    setPendientes(leerCola().length);
    const sesionLocal: SesionCaja = {
      _id: `local-${generarIdLocal()}`,
      efectivoInicial,
      fechaApertura: new Date().toISOString(),
      offline: true,
    };
    setSesion(sesionLocal);
    guardarSesionCache(sesionLocal);
    setEfectivoInicialInput("");
  }

  async function abrirCaja() {
    setErrorCaja(null);
    const efectivoInicial = Number(efectivoInicialInput);
    if (!Number.isFinite(efectivoInicial) || efectivoInicial < 0) {
      setErrorCaja("Captura el efectivo inicial con el que abres la caja");
      return;
    }

    if (!isOnline) {
      abrirCajaOffline(efectivoInicial);
      return;
    }

    setAbriendoCaja(true);
    try {
      const res = await fetch("/api/caja/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ efectivoInicial }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorCaja(data.error || "No se pudo abrir la caja");
        return;
      }
      const data = await res.json();
      setSesion(data);
      guardarSesionCache(data);
      setEfectivoInicialInput("");
    } catch {
      abrirCajaOffline(efectivoInicial);
    } finally {
      setAbriendoCaja(false);
    }
  }

  function registrarRetiroOffline(monto: number, motivo: string) {
    agregarACola({ id: generarIdLocal(), tipo: "retiro", creadaEn: new Date().toISOString(), payload: { monto, motivo } });
    setPendientes(leerCola().length);
    setModalRetiro(false);
  }

  async function registrarRetiro() {
    setErrorRetiro(null);
    const monto = Number(retiroMonto);
    if (!monto || monto <= 0) {
      setErrorRetiro("Captura un monto válido");
      return;
    }
    const motivo = retiroMotivo.trim();
    if (!motivo) {
      setErrorRetiro("Captura el motivo del retiro");
      return;
    }

    if (!isOnline) {
      registrarRetiroOffline(monto, motivo);
      return;
    }

    setRetirando(true);
    try {
      const res = await fetch("/api/caja/retiros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto, motivo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorRetiro(data.error || "No se pudo registrar el retiro");
        return;
      }
      setModalRetiro(false);
    } catch {
      registrarRetiroOffline(monto, motivo);
    } finally {
      setRetirando(false);
    }
  }

  async function confirmarCorte() {
    setErrorCorte(null);
    if (!isOnline) {
      setErrorCorte("Necesitas conexión a internet para hacer el corte de caja.");
      return;
    }
    const contado = Number(efectivoContado);
    if (!Number.isFinite(contado) || contado < 0) {
      setErrorCorte("Captura el efectivo contado");
      return;
    }
    setCerrandoCaja(true);
    try {
      const res = await fetch("/api/caja/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ efectivoContado: contado, notas: notasCorte.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorCorte(data.error || "No se pudo cerrar la caja");
        return;
      }
      const cerrada = await res.json();
      setCorteCerrado({
        efectivoEsperado: cerrada.efectivoEsperado,
        efectivoContado: cerrada.efectivoContado,
        diferencia: cerrada.diferencia,
      });
      setSesion(null);
      guardarSesionCache(null);
    } catch {
      setErrorCorte("Se perdió la conexión a internet. Intenta de nuevo cuando vuelva la señal.");
    } finally {
      setCerrandoCaja(false);
    }
  }

  function cerrarModalCorte() {
    setModalCorte(false);
    setCorteCerrado(null);
  }

  function buscarPrecio(e: React.FormEvent) {
    e.preventDefault();
    if (!precioCodigo.trim()) return;
    setPrecioResultado(buscarPorCodigo(precioCodigo) ?? null);
  }

  const productosDisponibles = useMemo(
    () => productos.filter((p) => !carrito.some((l) => l.productoId === p._id)),
    [productos, carrito]
  );

  const bannerSync =
    erroresSync.length > 0 ? (
      <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <div>
          <p className="font-semibold">No se pudieron sincronizar algunas acciones:</p>
          <ul className="mt-1 list-inside list-disc">
            {erroresSync.map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
        </div>
        <button onClick={() => setErroresSync([])} className="shrink-0 text-xs font-medium underline">
          Descartar
        </button>
      </div>
    ) : null;

  const badgeConexion = !isOnline ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
      <WifiOff className="h-3.5 w-3.5" />
      Sin conexión{pendientes > 0 ? ` · ${pendientes} por sincronizar` : ""}
    </span>
  ) : pendientes > 0 ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
      <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? "animate-spin" : ""}`} />
      {sincronizando ? "Sincronizando..." : `${pendientes} pendiente(s) por sincronizar`}
    </span>
  ) : null;

  if (sesion === undefined) {
    return <p className="text-sm text-black/50">Cargando punto de venta...</p>;
  }

  if (sesion === null) {
    return (
      <div className="space-y-4">
        {bannerSync}
        <Card className="mx-auto max-w-md">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-titos-green-900">Abrir caja</h2>
            {badgeConexion}
          </div>
          <p className="mb-4 text-sm text-black/50">
            Antes de registrar ventas, captura el efectivo con el que inicias esta caja.
            {!isOnline ? " Puedes abrirla sin conexión: se sincronizará en cuanto vuelva la señal." : ""}
          </p>
          <FormField label="Efectivo inicial">
            <Input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={efectivoInicialInput}
              onChange={(e) => setEfectivoInicialInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") abrirCaja();
              }}
              placeholder="0.00"
            />
          </FormField>
          {errorCaja ? <p className="mt-2 text-sm text-red-600">{errorCaja}</p> : null}
          <Button onClick={abrirCaja} disabled={abriendoCaja} className="mt-4 w-full justify-center">
            {abriendoCaja ? "Abriendo..." : "Abrir caja"}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {bannerSync}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        {/* Barra superior tipo menú */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-[#eef3fa] px-2 py-1">
          <div className="flex flex-wrap items-center">
            <button
              onClick={() => {
                setPrecioCodigo("");
                setPrecioResultado(undefined);
                setModalPrecio(true);
              }}
              className="rounded px-2.5 py-1 text-sm text-black/70 hover:bg-black/5"
            >
              Consultar precio <span className="text-xs text-black/35">(Alt+C)</span>
            </button>
            <button
              onClick={() => {
                setErrorRetiro(null);
                setRetiroMonto("");
                setRetiroMotivo("");
                setModalRetiro(true);
              }}
              className="rounded px-2.5 py-1 text-sm text-black/70 hover:bg-black/5"
            >
              Retirar efectivo <span className="text-xs text-black/35">(Alt+R)</span>
            </button>
            <button
              onClick={() => {
                setEfectivoContado("");
                setNotasCorte("");
                setCorteCerrado(null);
                setModalCorte(true);
                cargarResumenCorte();
              }}
              className="rounded px-2.5 py-1 text-sm text-black/70 hover:bg-black/5"
            >
              Corte de caja <span className="text-xs text-black/35">(Alt+T)</span>
            </button>
          </div>
          <div className="flex items-center gap-2 pr-1 text-xs text-black/50">
            {badgeConexion}
            <span>
              Caja abierta {sesion.offline ? "(sin sincronizar)" : ""} · {formatMoney(sesion.efectivoInicial)} ·{" "}
              {new Date(sesion.fechaApertura).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
              {nombreCajero(sesion) ? ` · ${nombreCajero(sesion)}` : ""}
            </span>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="flex flex-col gap-2 border-b border-black/5 px-3 py-3 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-3">
            <ShoppingCart className="hidden h-7 w-7 shrink-0 text-black/50 sm:block" />
            <form onSubmit={procesarCodigo} className="flex flex-1">
              <Input
                ref={inputRef}
                icon={ScanLine}
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Escanea o escribe el código y presiona Enter"
                className="rounded-r-none border-r-0 text-base"
              />
              <button
                type="submit"
                title="Agregar por código"
                className="rounded-r-lg bg-sky-600 px-3.5 text-white transition-colors hover:bg-sky-700"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>
          </div>
          <div className="w-full md:w-72">
            <ProductoCombobox
              productos={productosDisponibles}
              value={busquedaId}
              onChange={agregarPorBusqueda}
              placeholder="Buscar por nombre o SKU..."
            />
          </div>
        </div>
        {error ? <p className="border-b border-black/5 px-4 py-2 text-sm text-red-600">{error}</p> : null}

        {/* Cuerpo: tabla + panel derecho */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-85 flex-1 overflow-auto lg:min-h-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-linear-to-b from-sky-500 to-sky-600 text-white">
                  <th className="px-3 py-2 font-semibold">Código</th>
                  <th className="px-2 py-2 font-semibold">Artículo</th>
                  <th className="px-2 py-2 text-right font-semibold">Cantidad</th>
                  <th className="px-2 py-2 text-right font-semibold">Precio</th>
                  <th className="px-2 py-2 text-right font-semibold">Descuento</th>
                  <th className="px-2 py-2 text-right font-semibold">Total</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {carrito.map((l) => {
                  const stock = inventario.get(l.productoId);
                  const cantidad = Number(l.cantidad) || 0;
                  const sinStock = stock != null && cantidad > stock;
                  return (
                    <tr key={l.productoId} className="border-b border-black/5 odd:bg-white even:bg-sky-50/60">
                      <td className="px-3 py-1.5 font-mono text-xs text-black/60">{l.sku}</td>
                      <td className="px-2 py-1.5 font-medium uppercase">
                        {l.nombre}
                        {sinStock ? (
                          <p className="text-xs font-normal normal-case text-red-600">Stock disponible: {stock}</p>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            min="0"
                            step={l.unidad === "kg" ? "0.001" : "1"}
                            value={l.cantidad}
                            onChange={(e) => actualizarCantidad(l.productoId, e.target.value)}
                            className="w-20 py-1 text-right"
                          />
                          <span className="text-xs text-black/40">{l.unidad}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right text-black/70">{formatMoney(l.precioUnitario)}</td>
                      <td className="px-2 py-1.5 text-right text-black/40">$0.00</td>
                      <td className="px-2 py-1.5 text-right font-semibold">{formatMoney(cantidad * l.precioUnitario)}</td>
                      <td className="px-2 py-1.5 text-right">
                        <button onClick={() => quitarLinea(l.productoId)} className="text-red-500 hover:text-red-700" title="Quitar">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {carrito.length === 0 ? (
              <p className="px-4 py-16 text-center text-sm text-black/40">
                Escanea o busca productos para iniciar la venta.
              </p>
            ) : null}
          </div>

          {/* Panel derecho de totales */}
          <div className="w-full shrink-0 space-y-2 border-t border-black/10 bg-[#f4f8fc] p-3 lg:w-72 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg border border-black/10 bg-white px-2 py-1.5">
                <p className="text-xs font-semibold text-black/50">Artículos</p>
                <p className="text-lg font-bold text-black/80">{carrito.length}</p>
              </div>
              <div className="rounded-lg border border-black/10 bg-white px-2 py-1.5">
                <p className="text-xs font-semibold text-black/50">Tipo de cambio</p>
                <p className="text-lg font-bold text-black/80">{tipoCambio > 0 ? formatDolares(tipoCambio) : "—"}</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm">
              <span className="font-semibold uppercase text-black/50">Total en dólares:</span>
              <span className="font-bold text-black/80">{totalDolares != null ? formatDolares(totalDolares) : "—"}</span>
            </div>

            <div className="space-y-1 rounded-lg bg-linear-to-b from-sky-500 to-sky-600 px-3 py-2 text-white">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Pago:</span>
                <span className="font-bold">{formatMoney(sumaPagos)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold uppercase">Cambio pesos:</span>
                <span className="font-bold">{formatMoney(cambio != null && cambio > 0 ? cambio : 0)}</span>
              </div>
            </div>

            <div className="space-y-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase text-sky-700">Subtotal</span>
                <span className="font-bold text-sky-700">{formatMoney(total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase text-black/50">Descuento</span>
                <span className="font-bold text-black/50">{formatMoney(0)}</span>
              </div>
            </div>

            <div className="rounded-lg bg-linear-to-b from-sky-500 to-sky-600 px-3 py-2 text-right text-white">
              <p className="text-sm font-bold uppercase tracking-wide">Total pesos</p>
              <p className="text-4xl font-extrabold leading-tight">{formatMoney(total)}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => setCarrito([])}
                disabled={carrito.length === 0}
                title="Vaciar carrito"
                className="grid h-12 place-items-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-5 w-5" />
              </button>
              <button
                onClick={cancelarVenta}
                disabled={carrito.length === 0 && sumaPagos === 0}
                title="Cancelar venta"
                className="grid h-12 place-items-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                onClick={abrirCobro}
                disabled={!carritoValido}
                title="Cobrar"
                className="grid h-12 place-items-center rounded-lg bg-emerald-500 text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <DollarSign className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Barra inferior */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 bg-[#eef3fa] px-3 py-1.5 text-xs text-black/60">
          <span className="font-semibold uppercase">
            Sucursal: {sucursalNombre || "—"} · Estación: Caja 1
          </span>
          <span className="inline-flex items-center gap-1.5">
            {isOnline ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-600" /> Servicio en línea
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-red-600" /> Sin conexión
              </>
            )}
          </span>
        </div>
      </div>

      {modalCobro ? (
        <Modal open onClose={() => setModalCobro(false)} title="Cobrar venta" icon={DollarSign}>
          <p className="text-sm text-black/50">Total a pagar</p>
          <p className="mb-1 text-3xl font-bold text-titos-green-900">{formatMoney(total)}</p>
          {totalDolares != null ? (
            <p className="mb-3 text-sm font-semibold text-sky-700">
              Total en dólares: {formatDolares(totalDolares)}{" "}
              <span className="font-normal text-black/40">(tipo de cambio {formatDolares(tipoCambio)})</span>
            </p>
          ) : (
            <div className="mb-3" />
          )}

          <p className="mb-2 text-xs font-medium text-black/40">
            Puedes dividir el pago entre varias formas (ej. una parte en efectivo y otra con tarjeta).
          </p>

          <div className="mb-2 space-y-2">
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={montoEfectivo}
                onChange={(e) => setMontoEfectivo(e.target.value)}
                placeholder="Efectivo"
              />
              <button
                type="button"
                onClick={() => completarCon("efectivo")}
                className="whitespace-nowrap text-xs font-medium text-titos-green-700 hover:underline"
              >
                Completar
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={montoTarjeta}
                onChange={(e) => setMontoTarjeta(e.target.value)}
                placeholder="Tarjeta"
              />
              <button
                type="button"
                onClick={() => completarCon("tarjeta")}
                className="whitespace-nowrap text-xs font-medium text-titos-green-700 hover:underline"
              >
                Completar
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={montoTransferencia}
                onChange={(e) => setMontoTransferencia(e.target.value)}
                placeholder="Transferencia"
              />
              <button
                type="button"
                onClick={() => completarCon("transferencia")}
                className="whitespace-nowrap text-xs font-medium text-titos-green-700 hover:underline"
              >
                Completar
              </button>
            </div>
          </div>

          <p className={`mb-3 text-sm font-semibold ${restante > 0 ? "text-red-600" : "text-black/40"}`}>
            {restante > 0
              ? `Restante por asignar: ${formatMoney(restante)}`
              : restante < 0
                ? `Te pasaste por ${formatMoney(Math.abs(restante))}`
                : "Pago completo"}
          </p>

          {nEfectivo > 0 ? (
            <FormField label="Efectivo recibido del cliente" className="mb-3">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={efectivoRecibido}
                onChange={(e) => setEfectivoRecibido(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && puedeCobrar && !procesando) cobrar();
                }}
                placeholder="0.00"
              />
            </FormField>
          ) : null}

          {nEfectivo > 0 && efectivoRecibido ? (
            <p className={`mb-3 text-sm font-semibold ${(cambio ?? 0) < 0 ? "text-red-600" : "text-titos-green-700"}`}>
              {(cambio ?? 0) < 0 ? "Falta" : "Cambio"}: {formatMoney(Math.abs(cambio ?? 0))}
            </p>
          ) : null}

          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalCobro(false)}>
              Cancelar
            </Button>
            <Button onClick={cobrar} disabled={!puedeCobrar || procesando}>
              {procesando ? "Procesando..." : "Cobrar"}
            </Button>
          </div>
        </Modal>
      ) : null}

      {pesaje ? (
        <Modal open onClose={() => setPesaje(null)} title={`Capturar peso — ${pesaje.nombre}`} icon={ScanLine}>
          <p className="mb-3 text-sm text-black/50">Este producto se vende por kilogramo. Captura el peso pesado.</p>
          <FormField label="Peso (kg)">
            <Input
              type="number"
              min="0"
              step="0.001"
              autoFocus
              value={pesoInput}
              onChange={(e) => setPesoInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmarPesaje();
              }}
            />
          </FormField>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPesaje(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarPesaje} disabled={!pesoInput || Number(pesoInput) <= 0}>
              Agregar al carrito
            </Button>
          </div>
        </Modal>
      ) : null}

      {ventaCompletada ? (
        <Modal
          open
          onClose={nuevaVenta}
          title={`Venta ${ventaCompletada.folio}`}
          icon={Receipt}
          footer={<Button onClick={nuevaVenta}>Nueva venta</Button>}
        >
          {ventaCompletada.offline ? (
            <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800">
              Guardada localmente — se sincronizará cuando vuelva la conexión.
            </p>
          ) : null}
          <ul className="mb-3 divide-y divide-black/5 text-sm">
            {ventaCompletada.items.map((i, idx) => (
              <li key={idx} className="flex items-center justify-between py-1.5">
                <span>
                  {i.nombreProducto} × {i.cantidad} {i.unidad}
                </span>
                <span className="font-medium">{formatMoney(i.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t border-black/10 pt-3 text-sm">
            <div className="flex justify-between font-semibold text-titos-green-900">
              <span>Total</span>
              <span>{formatMoney(ventaCompletada.total)}</span>
            </div>
            {ventaCompletada.pagos.map((p, idx) => (
              <div key={idx} className="flex justify-between text-black/50">
                <span>{ETIQUETAS_METODO[p.metodoPago]}</span>
                <span>{formatMoney(p.monto)}</span>
              </div>
            ))}
            {ventaCompletada.pagos.some((p) => p.metodoPago === "efectivo") ? (
              <>
                <div className="flex justify-between text-black/50">
                  <span>Efectivo recibido</span>
                  <span>{formatMoney(ventaCompletada.montoRecibido ?? 0)}</span>
                </div>
                <div className="flex justify-between text-black/50">
                  <span>Cambio</span>
                  <span>{formatMoney(ventaCompletada.cambio ?? 0)}</span>
                </div>
              </>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {modalPrecio ? (
        <Modal open onClose={() => setModalPrecio(false)} title="Consultar precio" icon={Search}>
          <form onSubmit={buscarPrecio} className="mb-4 flex gap-2">
            <Input
              icon={ScanLine}
              autoFocus
              value={precioCodigo}
              onChange={(e) => setPrecioCodigo(e.target.value)}
              placeholder="Escanea o escribe el código del producto"
            />
            <Button type="submit">Buscar</Button>
          </form>
          {precioResultado === undefined ? null : precioResultado === null ? (
            <p className="text-sm text-red-600">No se encontró ningún producto con ese código.</p>
          ) : (
            <div className="rounded-xl bg-titos-green-100 p-4">
              <p className="font-semibold text-titos-green-900">{precioResultado.nombre}</p>
              <p className="mb-2 text-xs text-black/40">SKU: {precioResultado.sku}</p>
              <p className="text-2xl font-bold text-titos-green-900">{formatMoney(precioResultado.precioVenta)}</p>
              {tipoCambio > 0 ? (
                <p className="text-sm font-semibold text-sky-700">
                  {formatDolares(precioResultado.precioVenta / tipoCambio)} USD
                </p>
              ) : null}
              <p className="text-xs text-black/50">
                por {precioResultado.unidad} · Stock disponible:{" "}
                {inventario.get(precioResultado._id) ?? 0}
              </p>
            </div>
          )}
        </Modal>
      ) : null}

      {modalRetiro ? (
        <Modal open onClose={() => setModalRetiro(false)} title="Retirar efectivo" icon={Banknote}>
          <p className="mb-3 text-sm text-black/50">
            Registra un retiro de efectivo de la caja (por ejemplo, para pagar a un proveedor o resguardar dinero).
          </p>
          <FormField label="Monto" className="mb-3">
            <Input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={retiroMonto}
              onChange={(e) => setRetiroMonto(e.target.value)}
              placeholder="0.00"
            />
          </FormField>
          <FormField label="Motivo">
            <Input value={retiroMotivo} onChange={(e) => setRetiroMotivo(e.target.value)} placeholder="Ej. pago a proveedor" />
          </FormField>
          {errorRetiro ? <p className="mt-2 text-sm text-red-600">{errorRetiro}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalRetiro(false)}>
              Cancelar
            </Button>
            <Button onClick={registrarRetiro} disabled={retirando}>
              {retirando ? "Registrando..." : "Registrar retiro"}
            </Button>
          </div>
        </Modal>
      ) : null}

      {modalCorte ? (
        <Modal open onClose={cerrarModalCorte} title="Nuevo corte de caja" icon={ClipboardCheck} size="lg">
          {corteCerrado ? (
            <div>
              <p className="mb-4 text-sm text-black/50">La caja se cerró correctamente.</p>
              <div className="space-y-1 rounded-xl bg-black/2 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-black/50">Efectivo esperado</span>
                  <span className="font-medium">{formatMoney(corteCerrado.efectivoEsperado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/50">Efectivo contado</span>
                  <span className="font-medium">{formatMoney(corteCerrado.efectivoContado)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>{corteCerrado.diferencia < 0 ? "Faltante" : "Sobrante"}</span>
                  <span className={corteCerrado.diferencia < 0 ? "text-red-600" : "text-titos-green-700"}>
                    {formatMoney(Math.abs(corteCerrado.diferencia))}
                  </span>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <Button onClick={cerrarModalCorte}>Aceptar</Button>
              </div>
            </div>
          ) : !resumenCorte && (!isOnline || errorCorte) ? (
            <div>
              <p className="text-sm text-red-600">{errorCorte || "Necesitas conexión a internet para hacer el corte de caja."}</p>
              <div className="mt-5 flex justify-end">
                <Button variant="ghost" onClick={cerrarModalCorte}>
                  Cerrar
                </Button>
              </div>
            </div>
          ) : cargandoResumen || !resumenCorte ? (
            <p className="text-sm text-black/50">Calculando resumen de caja...</p>
          ) : (
            <div>
              <div className="mb-4 space-y-1 rounded-xl bg-black/2 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-black/50">Ventas registradas</span>
                  <span className="font-medium">{resumenCorte.cantidadVentas}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/50">Efectivo inicial</span>
                  <span className="font-medium">{formatMoney(resumenCorte.sesion.efectivoInicial)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/50">+ Ventas en efectivo</span>
                  <span className="font-medium">{formatMoney(resumenCorte.totalVentasEfectivo)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/50">Ventas con tarjeta</span>
                  <span className="font-medium">{formatMoney(resumenCorte.totalVentasTarjeta)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/50">Ventas por transferencia</span>
                  <span className="font-medium">{formatMoney(resumenCorte.totalVentasTransferencia)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/50">− Retiros de efectivo ({resumenCorte.cantidadRetiros})</span>
                  <span className="font-medium">{formatMoney(resumenCorte.totalRetiros)}</span>
                </div>
                <div className="flex justify-between border-t border-black/10 pt-1.5 font-semibold text-titos-green-900">
                  <span>= Efectivo esperado en caja</span>
                  <span>{formatMoney(resumenCorte.efectivoEsperado)}</span>
                </div>
              </div>

              <FormField label="Efectivo contado" className="mb-3">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={efectivoContado}
                  onChange={(e) => setEfectivoContado(e.target.value)}
                  placeholder="0.00"
                />
              </FormField>

              {efectivoContado ? (
                (() => {
                  const diferencia = Number(efectivoContado) - resumenCorte.efectivoEsperado;
                  return (
                    <p className={`mb-3 text-sm font-semibold ${diferencia < 0 ? "text-red-600" : "text-titos-green-700"}`}>
                      {diferencia < 0 ? "Faltante" : "Sobrante"}: {formatMoney(Math.abs(diferencia))}
                    </p>
                  );
                })()
              ) : null}

              <FormField label="Notas (opcional)" className="mb-3">
                <Input value={notasCorte} onChange={(e) => setNotasCorte(e.target.value)} placeholder="Observaciones del corte" />
              </FormField>

              {errorCorte ? <p className="mb-3 text-sm text-red-600">{errorCorte}</p> : null}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={cerrarModalCorte}>
                  Cancelar
                </Button>
                <Button onClick={confirmarCorte} disabled={cerrandoCaja || !efectivoContado}>
                  {cerrandoCaja ? "Cerrando..." : "Cerrar caja y confirmar corte"}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
