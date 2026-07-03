import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Proveedor from "@/models/Proveedor";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";
import { normalizarWhatsAppMX } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  await connectDB();
  const url = new URL(req.url);
  const filter = url.searchParams.get("todos") ? {} : { activo: true };
  const proveedores = await Proveedor.find(filter).sort({ nombre: 1 }).lean();
  return NextResponse.json(proveedores);
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  if (!body?.nombre) {
    return badRequest("El nombre del proveedor es requerido");
  }

  await connectDB();
  const proveedor = await Proveedor.create({
    nombre: body.nombre,
    contacto: body.contacto || "",
    whatsapp: body.whatsapp ? normalizarWhatsAppMX(body.whatsapp) : "",
    email: body.email || "",
  });

  return NextResponse.json(proveedor, { status: 201 });
}
