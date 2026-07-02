import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Proveedor from "@/models/Proveedor";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  await connectDB();
  const proveedores = await Proveedor.find({ activo: true }).sort({ nombre: 1 }).lean();
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
    telefono: body.telefono || "",
    email: body.email || "",
  });

  return NextResponse.json(proveedor, { status: 201 });
}
