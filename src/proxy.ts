import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { permisoDeRuta, tienePermiso } from "@/lib/permisos";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isMatrizRoute = pathname.startsWith("/matriz");
  const isSucursalRoute = pathname.startsWith("/sucursal");

  if (!isMatrizRoute && !isSucursalRoute) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isMatrizRoute && session.role !== "matriz") {
    return NextResponse.redirect(new URL("/sucursal", req.url));
  }

  if (isSucursalRoute && session.role !== "sucursal") {
    return NextResponse.redirect(new URL("/matriz", req.url));
  }

  // Bloqueo por permiso: aunque alguien escriba la URL a mano, si su rol no lo
  // incluye regresa a su inicio. El menú ya oculta estas rutas, pero ocultar no
  // es proteger.
  //
  // Los tokens emitidos antes de que existieran los roles no traen permisos;
  // `tienePermiso` los deduce del perfil viejo, así que una sesión abierta al
  // momento del despliegue sigue funcionando igual hasta que expire.
  const permiso = permisoDeRuta(pathname);
  if (permiso && !tienePermiso(session, permiso)) {
    return NextResponse.redirect(new URL(session.role === "matriz" ? "/matriz" : "/sucursal", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/matriz/:path*", "/sucursal/:path*"],
};
