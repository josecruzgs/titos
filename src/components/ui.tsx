import { type ReactNode } from "react";
import { X } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-black/5 bg-white p-5 shadow-sm ${className}`}>{children}</div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-titos-green-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-black/60">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

const ESTADO_STYLES: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  nivelado: "bg-sky-100 text-sky-800",
  surtido: "bg-titos-orange-100 text-titos-orange-700",
  recibido: "bg-titos-green-100 text-titos-green-700",
  borrador: "bg-black/5 text-black/60",
  solicitada: "bg-sky-100 text-sky-800",
  recibida: "bg-titos-green-100 text-titos-green-700",
  cancelada: "bg-red-100 text-red-700",
  asignada: "bg-sky-100 text-sky-800",
  convertida: "bg-titos-green-100 text-titos-green-700",
};

export function EstadoBadge({ estado }: { estado: string }) {
  const style = ESTADO_STYLES[estado] ?? "bg-black/5 text-black/70";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${style}`}>
      {estado.replaceAll("_", " ")}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants: Record<string, string> = {
    primary: "bg-titos-green-600 text-white hover:bg-titos-green-700",
    secondary: "bg-titos-orange-600 text-white hover:bg-titos-orange-700",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "bg-transparent text-titos-green-700 hover:bg-titos-green-100",
  };
  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-titos-green-500 focus:ring-2 focus:ring-titos-green-100 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-titos-green-500 focus:ring-2 focus:ring-titos-green-100 ${props.className ?? ""}`}
    />
  );
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-titos-green-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-black/40 hover:bg-black/5 hover:text-black/60">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-black/5 pt-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-black/10 bg-black/[0.02] p-8 text-center text-sm text-black/50">
      {message}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3 text-sm">
      <p className="text-black/50">
        Mostrando {from}–{to} de {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg px-3 py-1.5 font-medium text-titos-green-700 hover:bg-titos-green-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Anterior
        </button>
        <span className="px-2 text-black/50">
          Página {page} de {totalPages}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg px-3 py-1.5 font-medium text-titos-green-700 hover:bg-titos-green-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
