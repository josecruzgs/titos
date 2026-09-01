import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Sucursal from "@/models/Sucursal";
import UserModel from "@/models/User";
import { requireSession, unauthorized, forbidden } from "@/lib/apiAuth";
import { consultarBitacora, TIPOS_BITACORA, type TipoBitacora } from "@/lib/bitacora";

// La bitácora es una herramienta de auditoría de matriz: una sucursal no debe
// poder revisar lo que hicieron las demás.
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  await connectDB();
  const url = new URL(req.url);

  const desdeParam = url.searchParams.get("desde");
  const hastaParam = url.searchParams.get("hasta");
  const tiposParam = url.searchParams.get("tipos");

  const tipos = (tiposParam ? tiposParam.split(",") : [])
    .map((t) => t.trim())
    .filter((t): t is TipoBitacora => TIPOS_BITACORA.includes(t as TipoBitacora));

  const [eventos, sucursales, usuarios] = await Promise.all([
    consultarBitacora({
      desde: desdeParam ? new Date(`${desdeParam}T00:00:00`) : undefined,
      // El "hasta" es inclusivo: quien filtra por un día espera ver ese día completo.
      hasta: hastaParam ? new Date(`${hastaParam}T23:59:59.999`) : undefined,
      sucursalId: url.searchParams.get("sucursalId") || undefined,
      usuarioId: url.searchParams.get("usuarioId") || undefined,
      tipos,
    }),
    Sucursal.find({}).select("nombre").sort({ nombre: 1 }).lean(),
    UserModel.find({}).select("nombre role").sort({ nombre: 1 }).lean(),
  ]);

  return NextResponse.json({
    eventos,
    sucursales: sucursales.map((s) => ({ _id: String(s._id), nombre: s.nombre })),
    usuarios: usuarios.map((u) => ({ _id: String(u._id), nombre: u.nombre, role: u.role })),
  });
}
