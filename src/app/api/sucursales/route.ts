import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Sucursal from "@/models/Sucursal";
import UserModel from "@/models/User";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";
import { hashPassword } from "@/lib/auth";
import { normalizarWhatsAppMX } from "@/lib/whatsapp";
import { ZONA_HORARIA_DEFAULT, esZonaHorariaValida } from "@/lib/zonasHorarias";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  await connectDB();
  const sucursales = await Sucursal.find({}).sort({ nombre: 1 }).lean();

  const usuarios = await UserModel.find({
    role: "sucursal",
    sucursalId: { $in: sucursales.map((s) => s._id) },
  })
    .select("email nombre sucursalId")
    .lean();
  const usuarioPorSucursal = new Map(usuarios.map((u) => [String(u.sucursalId), u]));

  const sucursalesConUsuario = sucursales.map((s) => {
    const usuario = usuarioPorSucursal.get(String(s._id));
    return { ...s, usuario: usuario ? { email: usuario.email, nombre: usuario.nombre } : null };
  });

  return NextResponse.json(sucursalesConUsuario);
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  if (!body?.nombre || !body?.email || !body?.password) {
    return badRequest("Faltan campos requeridos (nombre, email, password para el usuario de la sucursal)");
  }

  if ("zonaHoraria" in body && !esZonaHorariaValida(body.zonaHoraria)) {
    return badRequest("Zona horaria inválida");
  }

  await connectDB();

  const sucursal = await Sucursal.create({
    nombre: body.nombre,
    direccion: body.direccion || "",
    whatsapp: body.whatsapp ? normalizarWhatsAppMX(body.whatsapp) : "",
    zonaHoraria: body.zonaHoraria || ZONA_HORARIA_DEFAULT,
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
