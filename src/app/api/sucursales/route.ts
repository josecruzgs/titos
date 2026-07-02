import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Sucursal from "@/models/Sucursal";
import UserModel from "@/models/User";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";
import { hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  await connectDB();
  const sucursales = await Sucursal.find({ activo: true }).sort({ nombre: 1 }).lean();
  return NextResponse.json(sucursales);
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  if (!body?.nombre || !body?.email || !body?.password) {
    return badRequest("Faltan campos requeridos (nombre, email, password para el usuario de la sucursal)");
  }

  await connectDB();

  const sucursal = await Sucursal.create({
    nombre: body.nombre,
    direccion: body.direccion || "",
  });

  const passwordHash = await hashPassword(body.password);
  const user = await UserModel.create({
    email: body.email.toLowerCase().trim(),
    passwordHash,
    nombre: body.usuarioNombre || body.nombre,
    role: "sucursal",
    sucursalId: sucursal._id,
  });

  return NextResponse.json(
    { sucursal, usuario: { email: user.email, nombre: user.nombre } },
    { status: 201 }
  );
}
