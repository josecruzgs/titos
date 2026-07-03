import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Empleado from "@/models/Empleado";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";
import { normalizarWhatsAppMX } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  await connectDB();
  const url = new URL(req.url);
  const filter = url.searchParams.get("todos") ? {} : { activo: true };
  const empleados = await Empleado.find(filter).sort({ nombre: 1 }).lean();
  return NextResponse.json(empleados);
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  if (!body?.nombre || !body?.whatsapp) {
    return badRequest("El nombre y el WhatsApp del empleado son requeridos");
  }

  await connectDB();
  const empleado = await Empleado.create({
    nombre: body.nombre,
    puesto: body.puesto || "",
    whatsapp: normalizarWhatsAppMX(body.whatsapp),
  });

  return NextResponse.json(empleado, { status: 201 });
}
