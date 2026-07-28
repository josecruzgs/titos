"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Store,
  ClipboardList,
  ShoppingCart,
  Truck,
  Users,
  Settings,
  BarChart3,
  PlusCircle,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  FileText,
  Wrench,
  Receipt,
  Tags,
  Tag,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavCategory = { label: string; icon: LucideIcon; items: NavItem[] };

const MATRIZ_NAV: NavCategory[] = [
  {
    label: "Central",
    icon: LayoutDashboard,
    items: [{ href: "/matriz", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Reportes",
    icon: FileText,
    items: [{ href: "/matriz/reportes", label: "Reportes", icon: BarChart3 }],
  },
  {
    label: "Productos",
    icon: Package,
    items: [{ href: "/matriz/productos", label: "Productos", icon: Package }],
  },
  {
    label: "Servicios",
    icon: Wrench,
    items: [],
  },
  {
    label: "Catálogos",
    icon: ClipboardList,
    items: [
      { href: "/matriz/sucursales", label: "Sucursales", icon: Store },
      { href: "/matriz/proveedores", label: "Proveedores", icon: Truck },
      { href: "/matriz/personal", label: "Personal", icon: Users },
      { href: "/matriz/lineas", label: "Líneas", icon: Tags },
      { href: "/matriz/categorias", label: "Categorías", icon: Tag },
    ],
  },
  {
    label: "Orden de Compra",
    icon: ShoppingCart,
    items: [{ href: "/matriz/ordenes-compra", label: "Órdenes de compra", icon: ShoppingCart }],
  },
  {
    label: "Configuraciones",
    icon: Settings,
    items: [{ href: "/matriz/configuracion", label: "Configuración", icon: Settings }],
  },
  {
    label: "Inventario",
    icon: Warehouse,
    items: [
      { href: "/matriz/inventario", label: "Inventario", icon: Warehouse },
      { href: "/matriz/pedidos", label: "Pedidos", icon: ClipboardList },
    ],
  },
  {
    label: "Facturación",
    icon: Receipt,
    items: [],
  },
];

const SUCURSAL_NAV: NavItem[] = [
  { href: "/sucursal", label: "Punto de venta", icon: ShoppingCart },
  { href: "/sucursal/ventas", label: "Historial de ventas", icon: Receipt },
  { href: "/sucursal/nuevo-pedido", label: "Nuevo pedido", icon: PlusCircle },
  { href: "/sucursal/pedidos", label: "Mis pedidos", icon: ClipboardList },
  { href: "/sucursal/ajustes", label: "Ajustes", icon: Settings },
];

const STORAGE_KEY = "titos-sidebar-collapsed";

function isNavItemActive(pathname: string, role: string, href: string) {
  return pathname === href || (href !== `/${role}` && pathname.startsWith(href));
}

function initials(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Sidebar({
  role,
  nombre,
  sucursalNombre,
}: {
  role: "matriz" | "sucursal";
  nombre: string;
  sucursalNombre?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const mouseDownOnOverlay = useRef(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const category of MATRIZ_NAV) {
      initial[category.label] = category.items.some((item) => isNavItemActive(pathname, role, item.href));
    }
    return initial;
  });

  const roleLabel = role === "matriz" ? "Almacén Central" : "Sucursal";

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee preferencia persistida al montar
    if (stored === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cierra el drawer móvil al navegar
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const activeCategory = MATRIZ_NAV.find((category) =>
      category.items.some((item) => isNavItemActive(pathname, role, item.href))
    );
    if (!activeCategory) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abre la categoría de la ruta activa al navegar
    setOpenCategories((prev) => (prev[activeCategory.label] ? prev : { ...prev, [activeCategory.label]: true }));
  }, [pathname, role]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function toggleCategory(label: string) {
    setOpenCategories((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-black/5 bg-white px-4 py-3 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-titos-green-900 hover:bg-titos-green-100"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Image src="/media/logo.png" alt="Mercados Titos" width={512} height={184} className="h-7 w-auto" />
        <span className="w-9" />
      </div>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onMouseDown={(e) => {
            mouseDownOnOverlay.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            if (mouseDownOnOverlay.current && e.target === e.currentTarget) setMobileOpen(false);
            mouseDownOnOverlay.current = false;
          }}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-black/5 bg-white transition-all duration-200 ease-in-out md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-20" : "w-64"}`}
      >
        <div className={`flex items-center gap-2 border-b border-black/5 px-4 py-4 ${collapsed ? "md:justify-center md:px-0" : ""}`}>
          {collapsed ? (
            <Image
              src="/media/favicon.png"
              alt="Mercados Titos"
              width={904}
              height={904}
              className="hidden h-9 w-9 shrink-0 md:block"
            />
          ) : (
            <Image src="/media/logo.png" alt="Mercados Titos" width={512} height={184} className="h-8 w-auto md:h-9" />
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-black/40 hover:bg-titos-green-100 hover:text-black/60 md:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!collapsed ? (
          <div className="px-5 pt-4 pb-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-black/35">{roleLabel}</p>
            {role === "sucursal" && sucursalNombre ? (
              <p className="truncate text-sm font-semibold text-titos-green-900">{sucursalNombre}</p>
            ) : null}
          </div>
        ) : null}

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {role === "matriz"
            ? MATRIZ_NAV.map((category) => {
                const CategoryIcon = category.icon;
                const hasItems = category.items.length > 0;
                const isOpen = collapsed || !!openCategories[category.label];
                return (
                  <div key={category.label} className="space-y-1">
                    <button
                      type="button"
                      onClick={hasItems ? () => toggleCategory(category.label) : undefined}
                      disabled={!hasItems}
                      title={collapsed ? category.label : undefined}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        collapsed ? "md:justify-center md:px-0" : ""
                      } ${
                        hasItems
                          ? "text-titos-green-900/70 hover:bg-titos-green-100"
                          : "cursor-default text-titos-green-900/30"
                      }`}
                    >
                      <CategoryIcon className="h-4.5 w-4.5 shrink-0" />
                      <span className={`flex-1 text-left ${collapsed ? "md:hidden" : ""}`}>{category.label}</span>
                      {hasItems ? (
                        <span className={collapsed ? "md:hidden" : ""}>
                          {isOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          )}
                        </span>
                      ) : null}
                    </button>

                    {hasItems && isOpen ? (
                      <div className={collapsed ? "space-y-1" : "space-y-1 pl-4"}>
                        {category.items.map((item) => {
                          const active = isNavItemActive(pathname, role, item.href);
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              title={collapsed ? item.label : undefined}
                              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                                collapsed ? "md:justify-center md:px-0" : ""
                              } ${
                                active
                                  ? "bg-titos-green-600 text-white shadow-sm"
                                  : "text-titos-green-900/70 hover:bg-titos-green-100"
                              }`}
                            >
                              <Icon className="h-4.5 w-4.5 shrink-0" />
                              <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })
            : SUCURSAL_NAV.map((item) => {
                const active = isNavItemActive(pathname, role, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      collapsed ? "md:justify-center md:px-0" : ""
                    } ${
                      active
                        ? "bg-titos-green-600 text-white shadow-sm"
                        : "text-titos-green-900/70 hover:bg-titos-green-100"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
                  </Link>
                );
              })}
        </nav>

        <button
          onClick={toggleCollapsed}
          className="hidden items-center gap-2 border-t border-black/5 px-5 py-3 text-xs font-medium text-black/40 hover:bg-titos-green-100 hover:text-black/60 md:flex"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          <span className={collapsed ? "md:hidden" : ""}>Contraer menú</span>
        </button>

        <div className={`flex items-center gap-2.5 border-t border-black/5 p-4 ${collapsed ? "md:justify-center md:px-2" : ""}`}>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-titos-green-100 text-xs font-bold text-titos-green-700 ${collapsed ? "md:hidden" : ""}`}>
            {initials(nombre)}
          </span>
          <div className={`min-w-0 flex-1 ${collapsed ? "md:hidden" : ""}`}>
            <p className="truncate text-sm font-semibold text-titos-green-900">{nombre}</p>
            <p className="truncate text-xs text-black/40 capitalize">{role}</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Cerrar sesión"
            className="shrink-0 rounded-lg p-2 text-black/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
