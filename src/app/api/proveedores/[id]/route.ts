import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Proveedor from "@/models/Proveedor";
import { requireSession, unauthorized, forbidden, notFound } from "@/lib/apiAuth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  await connectDB();

  const updatable = ["nombre", "contacto", "telefono", "email", "activo"];
  const update: Record<string, unknown> = {};
  for (const key of updatable) {
    if (key in body) update[key] = body[key];
  }

  const proveedor = await Proveedor.findByIdAndUpdate(id, update, { new: true });
  if (!proveedor) return notFound("Proveedor no encontrado");

  return NextResponse.json(proveedor);
}
