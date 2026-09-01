import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import RolModel from "@/models/Rol";
import { requireSession, unauthorized, forbidden, badRequest, conflict, puede, sinPermiso } from "@/lib/apiAuth";
import { esPermisoValido } from "@/lib/permisos";
import { AMBITOS_ROL } from "@/lib/rolesConstantes";
import { asegurarRolesSemilla } from "@/lib/roles";

const PERMISO = "usuarios.administrar";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();
  if (!puede(session, PERMISO)) return sinPermiso(PERMISO);

  await connectDB();
  await asegurarRolesSemilla();

  const roles = await RolModel.find({}).sort({ ambito: 1, nombre: 1 }).lean();
  return NextResponse.json(roles.map((r) => ({ ...r, _id: String(r._id) })));
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();
  if (!puede(session, PERMISO)) return sinPermiso(PERMISO);

  const body = await req.json().catch(() => null);
  const nombre = String(body?.nombre ?? "").trim();
  const ambito = String(body?.ambito ?? "");

  if (!nombre) return badRequest("Ponle un nombre al rol");
  if (!AMBITOS_ROL.includes(ambito as (typeof AMBITOS_ROL)[number])) {
    return badRequest("Elige si el rol es de matriz o de sucursal");
  }

  // Los permisos desconocidos se filtran en vez de rechazar la petición: así un
  // permiso retirado del catálogo no impide guardar el resto del rol.
  const permisos: string[] = Array.isArray(body?.permisos)
    ? body.permisos.map((p: unknown) => String(p)).filter(esPermisoValido)
    : [];

  await connectDB();

  try {
    const rol = await RolModel.create({
      nombre,
      descripcion: String(body?.descripcion ?? "").trim(),
      ambito,
      permisos,
      esSistema: false,
    });
    return NextResponse.json({ ...rol.toObject(), _id: String(rol._id) }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === 11000) {
      return conflict("Ya existe un rol con ese nombre");
    }
    throw err;
  }
}
