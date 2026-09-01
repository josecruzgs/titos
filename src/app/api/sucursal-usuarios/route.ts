import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import UserModel from "@/models/User";
import { requireSession, unauthorized, forbidden, badRequest, conflict } from "@/lib/apiAuth";
import { hashPassword, type SessionPayload } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";

// Autoservicio de la sucursal: administra solo a los suyos. La administración
// global de usuarios vive en /matriz/usuarios.
function puedeAdministrar(session: SessionPayload) {
  return session.role === "sucursal" && !!session.sucursalId && tienePermiso(session, "sucursal.usuarios");
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (!puedeAdministrar(session)) return forbidden();

  await connectDB();
  const usuarios = await UserModel.find({ role: "sucursal", sucursalId: session.sucursalId })
    .select("nombre email sucursalRol activo")
    .sort({ nombre: 1 })
    .lean();

  return NextResponse.json(
    usuarios.map((u) => ({
      _id: String(u._id),
      nombre: u.nombre,
      email: u.email,
      sucursalRol: (u.sucursalRol as "admin" | "ventas") ?? "admin",
      activo: u.activo,
      propio: String(u._id) === session.userId,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (!puedeAdministrar(session)) return forbidden();

  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Cuerpo inválido");

  const nombre = String(body.nombre ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const sucursalRol = body.sucursalRol;

  if (!nombre) return badRequest("El nombre es requerido");
  if (!email) return badRequest("El correo es requerido");
  if (password.length < 6) return badRequest("La contraseña debe tener al menos 6 caracteres");
  if (!["admin", "ventas"].includes(sucursalRol)) return badRequest("Rol inválido");

  await connectDB();
  const yaExiste = await UserModel.findOne({ email });
  if (yaExiste) return conflict("Ese correo ya está en uso por otro usuario");

  const usuario = await UserModel.create({
    nombre,
    email,
    passwordHash: await hashPassword(password),
    role: "sucursal",
    sucursalRol,
    sucursalId: session.sucursalId,
    activo: true,
  });

  return NextResponse.json(
    {
      _id: String(usuario._id),
      nombre: usuario.nombre,
      email: usuario.email,
      sucursalRol: usuario.sucursalRol,
      activo: usuario.activo,
      propio: false,
    },
    { status: 201 }
  );
}
