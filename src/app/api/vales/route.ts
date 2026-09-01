import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import EmisorValeModel from "@/models/EmisorVale";
import BinValeModel from "@/models/BinVale";
import { requireSession, unauthorized, forbidden, badRequest, conflict, puede, sinPermiso } from "@/lib/apiAuth";
import { asegurarEmisoresSemilla, asignarBin, identificarVale, registrarLectura } from "@/lib/vales";

// Identificación de tarjetas de vales de despensa.
//
// GET  ?puntoVenta=1  → emisores activos, para el selector del punto de venta.
// GET                 → vista de matriz: emisores + BINs pendientes de clasificar.
// POST { lectura }    → identifica una tarjeta recién pasada por el lector.
// POST { bin, emisorId } → enseña al sistema de quién es ese BIN.

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  await connectDB();
  await asegurarEmisoresSemilla();

  const url = new URL(req.url);

  if (url.searchParams.get("puntoVenta")) {
    const emisores = await EmisorValeModel.find({ activo: true }).select("nombre").sort({ nombre: 1 }).lean();
    return NextResponse.json(emisores.map((e) => ({ _id: String(e._id), nombre: e.nombre })));
  }

  if (session.role !== "matriz") return forbidden();
  if (!puede(session, "catalogos.administrar")) return sinPermiso("catalogos.administrar");

  const [emisores, bins] = await Promise.all([
    EmisorValeModel.find({}).sort({ nombre: 1 }).lean(),
    BinValeModel.find({}).sort({ ultimaVez: -1 }).limit(200).lean(),
  ]);

  return NextResponse.json({
    emisores: emisores.map((e) => ({
      _id: String(e._id),
      nombre: e.nombre,
      prefijosBin: e.prefijosBin ?? [],
      activo: e.activo,
    })),
    bins: bins.map((b) => ({
      _id: String(b._id),
      bin: b.bin,
      emisorId: b.emisorId ? String(b.emisorId) : null,
      emisorNombre: b.emisorNombre ?? "",
      veces: b.veces ?? 0,
      ultimaVez: b.ultimaVez,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();

  const body = await req.json().catch(() => null);

  await connectDB();

  // --- Enseñarle al sistema de quién es un BIN ---
  if (body?.bin && body?.emisorId) {
    const bin = String(body.bin).replace(/\D/g, "");
    if (bin.length < 6) return badRequest("El BIN debe tener al menos 6 dígitos");

    const resultado = await asignarBin(bin, String(body.emisorId), session.userId);
    if (!resultado) return badRequest("El emisor no existe");
    return NextResponse.json(resultado);
  }

  // --- Identificar una tarjeta recién pasada por el lector ---
  const lectura = String(body?.lectura ?? "");
  if (!lectura) return badRequest("No se leyó ninguna tarjeta");

  const resultado = await identificarVale(lectura);
  if (!resultado) {
    return badRequest("No se pudo leer el número de la tarjeta. Vuelve a pasarla o captura los primeros 6 dígitos.");
  }

  await registrarLectura(resultado.bin);

  return NextResponse.json(resultado);
}

/** Alta de un emisor nuevo (los de arranque ya vienen sembrados). */
export async function PUT(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return unauthorized();
  if (session.role !== "matriz") return forbidden();
  if (!puede(session, "catalogos.administrar")) return sinPermiso("catalogos.administrar");

  const body = await req.json().catch(() => null);
  const nombre = String(body?.nombre ?? "").trim();
  if (!nombre) return badRequest("Ponle nombre al emisor");

  await connectDB();

  try {
    const emisor = await EmisorValeModel.create({ nombre });
    return NextResponse.json({ _id: String(emisor._id), nombre: emisor.nombre }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === 11000) {
      return conflict("Ya existe un emisor con ese nombre");
    }
    throw err;
  }
}
