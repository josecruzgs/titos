import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CategoriaProducto from "@/models/CategoriaProducto";
import { requireSession, unauthorized, forbidden, badRequest } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  await connectDB();
  const url = new URL(req.url);
  const filter = url.searchParams.get("todos") ? {} : { activo: true };
  const categorias = await CategoriaProducto.find(filter).sort({ nombre: 1 }).lean();
  return NextResponse.json(categorias);
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const body = await req.json().catch(() => null);
  if (!body?.nombre) {
    return badRequest("El nombre de la categoría es requerido");
  }

  await connectDB();
  try {
    const categoria = await CategoriaProducto.create({ nombre: body.nombre });
    return NextResponse.json(categoria, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === 11000) {
      return badRequest("Ya existe una categoría con ese nombre");
    }
    throw err;
  }
}
