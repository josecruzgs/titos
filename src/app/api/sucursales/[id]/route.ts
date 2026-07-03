import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Sucursal from "@/models/Sucursal";
import { requireSession, unauthorized, forbidden, notFound } from "@/lib/apiAuth";
import { normalizarWhatsAppMX } from "@/lib/whatsapp";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  const { id } = await params;
  if (session.role === "sucursal" && session.sucursalId !== id) return forbidden();
  if (session.role !== "matriz" && session.role !== "sucursal") return forbidden();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  await connectDB();

  const updatableComun = ["direccion", "whatsapp"];
  const updatableMatriz = ["nombre", "activo"];
  const permitidos = session.role === "matriz" ? [...updatableComun, ...updatableMatriz] : updatableComun;

  const update: Record<string, unknown> = {};
  for (const key of permitidos) {
    if (key in body) update[key] = body[key];
  }
  if (update.whatsapp) update.whatsapp = normalizarWhatsAppMX(update.whatsapp as string);

  const sucursal = await Sucursal.findByIdAndUpdate(id, update, { new: true });
  if (!sucursal) return notFound("Sucursal no encontrada");

  return NextResponse.json(sucursal);
}
