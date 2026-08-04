import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

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

  // El rol "ventas" solo tiene acceso al punto de venta
  if (isSucursalRoute && session.sucursalRol === "ventas" && pathname !== "/sucursal") {
    return NextResponse.redirect(new URL("/sucursal", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/matriz/:path*", "/sucursal/:path*"],
};
