"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Receipt,
  Search,
  TriangleAlert,
  Wallet,
  CalendarClock,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  FormField,
  FormGrid,
  Input,
  Modal,
  Select,
  formatMoney,
} from "@/components/ui";
import { REGIMENES_FISCALES, USOS_CFDI } from "@/lib/facturacion";
import {
  estadoCredito,
  formatFecha,
  type ClienteConCredito,
  type ResumenCredito,
} from "@/lib/creditoCliente";

type Cuenta = {
  _id: string;
  folio: string;
  fecha: string;
  fechaVencimiento: string;
  monto: number;
  saldo: number;
  estado: string;
  vencida: boolean;
};

type Abono = {
  _id: string;
  fecha: string;
  monto: number;
  metodoPago: string;
  notas: string;
  aplicaciones: { folio: string; monto: number }[];
};

const FORM_VACIO = {
  nombre: "",
  telefono: "",
  email: "",
  direccion: "",
  notas: "",
  activo: true,
  credito: { activo: false, limite: "", diasCredito: "30" },
  facturacion: {
    razonSocial: "",
    rfc: "",
    regimenFiscal: "",
    usoCfdi: "",
    codigoPostal: "",
    direccionFiscal: "",
    emailFacturacion: "",
  },
};

type FormState = typeof FORM_VACIO;

function clienteAForm(cliente: ClienteConCredito): FormState {
  return {
    nombre: cliente.nombre,
    telefono: cliente.telefono ?? "",
    email: cliente.email ?? "",
    direccion: cliente.direccion ?? "",
    notas: cliente.notas ?? "",
    activo: cliente.activo,
    credito: {
      activo: cliente.credito?.activo ?? false,
      limite: cliente.credito?.limite ? String(cliente.credito.limite) : "",
      diasCredito: String(cliente.credito?.diasCredito ?? 30),
    },
    facturacion: {
      razonSocial: cliente.facturacion?.razonSocial ?? "",
      rfc: cliente.facturacion?.rfc ?? "",
      regimenFiscal: cliente.facturacion?.regimenFiscal ?? "",
      usoCfdi: cliente.facturacion?.usoCfdi ?? "",
      codigoPostal: cliente.facturacion?.codigoPostal ?? "",
      direccionFiscal: cliente.facturacion?.direccionFiscal ?? "",
      emailFacturacion: cliente.facturacion?.emailFacturacion ?? "",
    },
  };
}

function formAPayload(form: FormState) {
  return {
    nombre: form.nombre,
    telefono: form.telefono,
    email: form.email,
    direccion: form.direccion,
    notas: form.notas,
    activo: form.activo,
    credito: {
      activo: form.credito.activo,
      limite: Number(form.credito.limite) || 0,
      diasCredito: Number(form.credito.diasCredito) || 30,
    },
    facturacion: form.facturacion,
  };
}

function ClienteFormModal({
  cliente,
  onClose,
  onGuardado,
}: {
  cliente: ClienteConCredito | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState<FormState>(cliente ? clienteAForm(cliente) : FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }
  function setCredito(campo: keyof FormState["credito"], valor: string | boolean) {
    setForm((prev) => ({ ...prev, credito: { ...prev.credito, [campo]: valor } }));
  }
  function setFacturacion(campo: keyof FormState["facturacion"], valor: string) {
    setForm((prev) => ({ ...prev, facturacion: { ...prev.facturacion, [campo]: valor } }));
  }

  async function guardar() {
    setError(null);
    setGuardando(true);

    const res = await fetch(cliente ? `/api/clientes/${cliente._id}` : "/api/clientes", {
      method: cliente ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formAPayload(form)),
    });

    setGuardando(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo guardar el cliente");
      return;
    }

    onGuardado();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={cliente ? `Editar ${cliente.nombre}` : "Nuevo cliente"}
      icon={User}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || !form.nombre.trim()}>
            {guardando ? "Guardando..." : cliente ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <FormField label="Nombre del cliente" className="sm:col-span-2">
            <Input icon={User} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </FormField>
          <FormField label="Teléfono">
            <Input icon={Phone} value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
          </FormField>
          <FormField label="Correo">
            <Input icon={Mail} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </FormField>
          <FormField label="Dirección" className="sm:col-span-2">
            <Input icon={MapPin} value={form.direccion} onChange={(e) => set("direccion", e.target.value)} />
          </FormField>
        </FormGrid>

        <label className="flex items-center gap-2 text-sm text-black/70">
          <input type="checkbox" checked={form.activo} onChange={(e) => set("activo", e.target.checked)} />
          Cliente activo
        </label>

        <div className="rounded-xl border border-black/10 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-black/40">
            <CreditCard className="h-3.5 w-3.5" /> Crédito
          </p>

          <label className="mb-3 flex items-center gap-2 text-sm text-black/70">
            <input
              type="checkbox"
              checked={form.credito.activo}
              onChange={(e) => setCredito("activo", e.target.checked)}
            />
            Este cliente tiene crédito autorizado
          </label>

          {form.credito.activo ? (
            <FormGrid>
              <FormField label="Límite de crédito">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.credito.limite}
                  onChange={(e) => setCredito("limite", e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label="Plazo de pago (días)">
                <Input
                  icon={CalendarClock}
                  type="number"
                  min="1"
                  max="365"
                  step="1"
                  value={form.credito.diasCredito}
                  onChange={(e) => setCredito("diasCredito", e.target.value)}
                />
              </FormField>
              <p className="text-xs text-black/40 sm:col-span-2">
                Cada venta a crédito vence a los {Number(form.credito.diasCredito) || 30} días de hecha. Si el cliente
                deja pasar una fecha de vencimiento sin liquidar, el punto de venta le bloquea el crédito hasta que se
                ponga al corriente.
              </p>
            </FormGrid>
          ) : null}
        </div>

        <div className="rounded-xl border border-black/10 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-black/40">
            <Receipt className="h-3.5 w-3.5" /> Datos de facturación
          </p>
          <FormGrid>
            <FormField label="Razón social" className="sm:col-span-2">
              <Input
                value={form.facturacion.razonSocial}
                onChange={(e) => setFacturacion("razonSocial", e.target.value)}
              />
            </FormField>
            <FormField label="RFC">
              <Input
                value={form.facturacion.rfc}
                onChange={(e) => setFacturacion("rfc", e.target.value.toUpperCase())}
                placeholder="XAXX010101000"
              />
            </FormField>
            <FormField label="Código postal fiscal">
              <Input
                value={form.facturacion.codigoPostal}
                onChange={(e) => setFacturacion("codigoPostal", e.target.value)}
                placeholder="21000"
              />
            </FormField>
            <FormField label="Régimen fiscal" className="sm:col-span-2">
              <Select
                value={form.facturacion.regimenFiscal}
                onChange={(e) => setFacturacion("regimenFiscal", e.target.value)}
              >
                <option value="">Sin especificar</option>
                {REGIMENES_FISCALES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Uso de CFDI" className="sm:col-span-2">
              <Select value={form.facturacion.usoCfdi} onChange={(e) => setFacturacion("usoCfdi", e.target.value)}>
                <option value="">Sin especificar</option>
                {USOS_CFDI.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Dirección fiscal" className="sm:col-span-2">
              <Input
                icon={MapPin}
                value={form.facturacion.direccionFiscal}
                onChange={(e) => setFacturacion("direccionFiscal", e.target.value)}
              />
            </FormField>
            <FormField label="Correo para facturas" className="sm:col-span-2">
              <Input
                icon={Mail}
                type="email"
                value={form.facturacion.emailFacturacion}
                onChange={(e) => setFacturacion("emailFacturacion", e.target.value)}
              />
            </FormField>
          </FormGrid>
        </div>

        <FormField label="Notas internas">
          <Input value={form.notas} onChange={(e) => set("notas", e.target.value)} />
        </FormField>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </Modal>
  );
}

function EstadoCuentaModal({
  cliente,
  onClose,
  onCambio,
}: {
  cliente: ClienteConCredito;
  onClose: () => void;
  onCambio: () => void;
}) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [abonos, setAbonos] = useState<Abono[]>([]);
  const [resumen, setResumen] = useState<ResumenCredito>(cliente.resumen);
  const [cargando, setCargando] = useState(true);

  const [monto, setMonto] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [notas, setNotas] = useState("");
  const [abonando, setAbonando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await fetch(`/api/clientes/${cliente._id}`);
    setCargando(false);
    if (!res.ok) return;
    const data = await res.json();
    setCuentas(data.cuentas ?? []);
    setAbonos(data.abonos ?? []);
    setResumen(data.resumen);
  }, [cliente._id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del estado de cuenta
    cargar();
  }, [cargar]);

  async function registrarAbono() {
    setError(null);
    setOk(null);
    setAbonando(true);

    const res = await fetch(`/api/clientes/${cliente._id}/abonos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monto: Number(monto), metodoPago, notas }),
    });

    setAbonando(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo registrar el abono");
      return;
    }

    setMonto("");
    setNotas("");
    setOk("Abono registrado.");
    await cargar();
    onCambio();
  }

  const pendientes = cuentas.filter((c) => c.estado === "pendiente");
  const montoValido = Number(monto) > 0 && Number(monto) <= resumen.saldo + 0.005;

  return (
    <Modal open onClose={onClose} title={`Estado de cuenta — ${cliente.nombre}`} icon={Wallet} size="xl">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-black/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Límite</p>
            <p className="text-xl font-bold text-titos-green-900">{formatMoney(resumen.limite)}</p>
          </div>
          <div className="rounded-xl border border-black/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Debe</p>
            <p className="text-xl font-bold text-black/80">{formatMoney(resumen.saldo)}</p>
          </div>
          <div className="rounded-xl border border-black/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Disponible</p>
            <p className="text-xl font-bold text-titos-green-700">{formatMoney(resumen.disponible)}</p>
          </div>
          <div className={`rounded-xl border p-3 ${resumen.tieneVencidos ? "border-red-200 bg-red-50" : "border-black/10"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Vencido</p>
            <p className={`text-xl font-bold ${resumen.tieneVencidos ? "text-red-600" : "text-black/40"}`}>
              {formatMoney(resumen.saldoVencido)}
            </p>
          </div>
        </div>

        {resumen.tieneVencidos ? (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Este cliente tiene {resumen.cuentasVencidas} {resumen.cuentasVencidas === 1 ? "venta vencida" : "ventas vencidas"}.
            No podrá comprar a crédito hasta liquidar {formatMoney(resumen.saldoVencido)}.
          </p>
        ) : resumen.proximoVencimiento ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Próximo pago: {formatFecha(resumen.proximoVencimiento)}
          </p>
        ) : null}

        {resumen.saldo > 0 ? (
          <div className="rounded-xl border border-black/10 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-black/40">Registrar abono</p>
            <FormGrid>
              <FormField label="Monto">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label="Forma de pago">
                <Select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </Select>
              </FormField>
              <FormField label="Referencia o nota" className="sm:col-span-2">
                <Input value={notas} onChange={(e) => setNotas(e.target.value)} />
              </FormField>
            </FormGrid>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button onClick={registrarAbono} disabled={abonando || !montoValido}>
                {abonando ? "Registrando..." : "Registrar abono"}
              </Button>
              <button
                type="button"
                onClick={() => setMonto(String(resumen.saldo))}
                className="text-xs font-medium text-titos-green-700 hover:underline"
              >
                Liquidar todo ({formatMoney(resumen.saldo)})
              </button>
              <span className="text-xs text-black/40">
                El abono se aplica primero a las ventas más próximas a vencer. En efectivo entra al corte de caja.
              </span>
            </div>
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            {ok ? <p className="mt-2 text-sm text-titos-green-700">{ok}</p> : null}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/40">
            Ventas a crédito ({pendientes.length} abiertas)
          </p>
          {cargando ? (
            <p className="text-sm text-black/50">Cargando...</p>
          ) : cuentas.length === 0 ? (
            <EmptyState message="Este cliente todavía no tiene ventas a crédito." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-black/50">
                    <th className="py-2 pr-2">Folio</th>
                    <th className="py-2 pr-2">Fecha</th>
                    <th className="py-2 pr-2">Vence</th>
                    <th className="py-2 pr-2 text-right">Monto</th>
                    <th className="py-2 pr-2 text-right">Saldo</th>
                    <th className="py-2 pl-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((c) => (
                    <tr key={c._id} className="border-b border-black/5">
                      <td className="py-2 pr-2 font-mono text-xs">{c.folio}</td>
                      <td className="py-2 pr-2 text-black/60">{formatFecha(c.fecha)}</td>
                      <td className={`py-2 pr-2 ${c.vencida ? "font-semibold text-red-600" : "text-black/60"}`}>
                        {formatFecha(c.fechaVencimiento)}
                      </td>
                      <td className="py-2 pr-2 text-right">{formatMoney(c.monto)}</td>
                      <td className="py-2 pr-2 text-right font-semibold">{formatMoney(c.saldo)}</td>
                      <td className="py-2 pl-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            c.estado === "pagada"
                              ? "bg-titos-green-100 text-titos-green-700"
                              : c.estado === "cancelada"
                                ? "bg-black/5 text-black/50"
                                : c.vencida
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {c.estado === "pendiente" ? (c.vencida ? "Vencida" : "Pendiente") : c.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/40">Abonos ({abonos.length})</p>
          {abonos.length === 0 ? (
            <EmptyState message="Sin abonos registrados." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-black/50">
                    <th className="py-2 pr-2">Fecha</th>
                    <th className="py-2 pr-2 text-right">Monto</th>
                    <th className="py-2 pr-2">Forma</th>
                    <th className="py-2 pr-2">Aplicado a</th>
                    <th className="py-2 pl-2">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {abonos.map((a) => (
                    <tr key={a._id} className="border-b border-black/5">
                      <td className="py-2 pr-2 text-black/60">{formatFecha(a.fecha)}</td>
                      <td className="py-2 pr-2 text-right font-semibold text-titos-green-700">{formatMoney(a.monto)}</td>
                      <td className="py-2 pr-2 capitalize text-black/60">{a.metodoPago}</td>
                      <td className="py-2 pr-2 font-mono text-xs text-black/50">
                        {a.aplicaciones.map((ap) => ap.folio).join(", ") || "—"}
                      </td>
                      <td className="py-2 pl-2 text-black/50">{a.notas || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function ClientesManager() {
  const [clientes, setClientes] = useState<ClienteConCredito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<ClienteConCredito | null>(null);
  const [estadoCuenta, setEstadoCuenta] = useState<ClienteConCredito | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await fetch("/api/clientes");
    setCargando(false);
    if (res.ok) setClientes(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      [c.nombre, c.telefono, c.email, c.facturacion?.rfc, c.facturacion?.razonSocial]
        .filter(Boolean)
        .some((campo) => campo!.toLowerCase().includes(q))
    );
  }, [clientes, busqueda]);

  const totales = useMemo(
    () => ({
      cartera: clientes.reduce((sum, c) => sum + c.resumen.saldo, 0),
      vencido: clientes.reduce((sum, c) => sum + c.resumen.saldoVencido, 0),
      conCredito: clientes.filter((c) => c.resumen.creditoActivo).length,
    }),
    [clientes]
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Cartera por cobrar</p>
          <p className="text-2xl font-bold text-titos-green-900">{formatMoney(totales.cartera)}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Vencido</p>
          <p className={`text-2xl font-bold ${totales.vencido > 0 ? "text-red-600" : "text-black/40"}`}>
            {formatMoney(totales.vencido)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Clientes con crédito</p>
          <p className="text-2xl font-bold text-titos-green-900">{totales.conCredito}</p>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-titos-green-900">Clientes ({clientes.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-56">
              <Input
                icon={Search}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, teléfono o RFC"
              />
            </div>
            <Button onClick={() => setCreando(true)}>+ Nuevo cliente</Button>
          </div>
        </div>

        {cargando ? (
          <p className="text-sm text-black/50">Cargando...</p>
        ) : filtrados.length === 0 ? (
          <EmptyState
            message={busqueda ? "Ningún cliente coincide con la búsqueda." : "Todavía no has dado de alta clientes."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-black/50">
                  <th className="py-2 pr-2">Cliente</th>
                  <th className="py-2 pr-2">Contacto</th>
                  <th className="py-2 pr-2 text-right">Límite</th>
                  <th className="py-2 pr-2 text-right">Debe</th>
                  <th className="py-2 pr-2 text-right">Disponible</th>
                  <th className="py-2 pr-2">Próximo pago</th>
                  <th className="py-2 pr-2">Estado</th>
                  <th className="w-px py-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const estado = estadoCredito(c.resumen);
                  return (
                    <tr key={c._id} className={`border-b border-black/5 ${!c.activo ? "opacity-50" : ""}`}>
                      <td className="py-2 pr-2 font-medium">
                        {c.nombre}
                        {!c.activo ? <span className="ml-1 text-xs text-black/40">(inactivo)</span> : null}
                        {c.facturacion?.rfc ? (
                          <span className="block font-mono text-xs text-black/40">{c.facturacion.rfc}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2 text-black/60">{c.telefono || c.email || "—"}</td>
                      <td className="py-2 pr-2 text-right text-black/60">
                        {c.resumen.creditoActivo ? formatMoney(c.resumen.limite) : "—"}
                      </td>
                      <td className="py-2 pr-2 text-right font-semibold">
                        {c.resumen.saldo > 0 ? formatMoney(c.resumen.saldo) : "—"}
                      </td>
                      <td className="py-2 pr-2 text-right text-titos-green-700">
                        {c.resumen.creditoActivo ? formatMoney(c.resumen.disponible) : "—"}
                      </td>
                      <td className={`py-2 pr-2 ${c.resumen.tieneVencidos ? "text-red-600" : "text-black/60"}`}>
                        {c.resumen.tieneVencidos ? "Vencido" : formatFecha(c.resumen.proximoVencimiento)}
                      </td>
                      <td className="py-2 pr-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${estado.className}`}>
                          {estado.label}
                        </span>
                      </td>
                      <td className="w-px py-2 pl-2 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="ghost" className="w-24" onClick={() => setEstadoCuenta(c)}>
                            Estado cuenta
                          </Button>
                          <Button size="sm" variant="ghost" className="w-16" onClick={() => setEditando(c)}>
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creando ? (
        <ClienteFormModal
          cliente={null}
          onClose={() => setCreando(false)}
          onGuardado={() => {
            setCreando(false);
            cargar();
          }}
        />
      ) : null}

      {editando ? (
        <ClienteFormModal
          cliente={editando}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            cargar();
          }}
        />
      ) : null}

      {estadoCuenta ? (
        <EstadoCuentaModal cliente={estadoCuenta} onClose={() => setEstadoCuenta(null)} onCambio={cargar} />
      ) : null}
    </div>
  );
}
