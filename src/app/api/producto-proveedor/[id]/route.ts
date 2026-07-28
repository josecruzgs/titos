import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ProductoProveedor from "@/models/ProductoProveedor";
import { requireSession, unauthorized, forbidden, notFound } from "@/lib/apiAuth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  await connectDB();

  const enlace = await ProductoProveedor.findById(id);
  if (!enlace) return notFound("Enlace producto-proveedor no encontrado");

  if ("costo" in body) enlace.costo = Number(body.costo) || 0;
  if ("ivaPct" in body) enlace.ivaPct = Number(body.ivaPct) || 0;
  if ("iepsPct" in body) enlace.iepsPct = Number(body.iepsPct) || 0;
  if ("esPrincipal" in body) enlace.esPrincipal = Boolean(body.esPrincipal);
  if ("activo" in body) enlace.activo = Boolean(body.activo);
  enlace.costoUnitario = enlace.costo + enlace.costo * ((enlace.ivaPct + enlace.iepsPct) / 100);

  await enlace.save();
  await enlace.populate("proveedorId", "nombre");

  return NextResponse.json(enlace);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();

  const { id } = await params;

  await connectDB();
  const enlace = await ProductoProveedor.findByIdAndDelete(id);
  if (!enlace) return notFound("Enlace producto-proveedor no encontrado");

  return NextResponse.json({ ok: true });
}
