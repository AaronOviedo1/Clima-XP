import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { esAdmin } from "@/lib/auth-guard";
import { datosDesdeRenta } from "@/lib/cotizacion";
import { ANCHO, altoDocumento, DocumentoCotizacion } from "./documento";

// Hoja de cotización como PNG (?renta=<id>), para mandársela al cliente por
// WhatsApp. Sirve para cualquier renta, cotizada o confirmada.
//
// La URL solo lleva el id: los importes salen de la BD (los snapshots de
// RentaUnidad), así que nadie puede fabricar una hoja con números inventados.
//
// La ruta NO debe terminar en .png: el matcher de proxy.ts exime las rutas .png
// (los iconos de la PWA se piden sin cookies) y la hoja quedaría pública.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rutas literales a propósito: armarlas dinámicamente (path.join(cwd, ...arr))
// hace que el tracing del build se lleve el proyecto entero al deploy.
const logoPromise = readFile(path.join(process.cwd(), "public", "HD_sinFondo.png"))
  .then((b) => `data:image/png;base64,${b.toString("base64")}`)
  .catch(() => null);

// Manrope es la tipografía de la app; satori necesita los bytes. Si faltaran,
// la hoja se dibuja con la fuente por defecto antes que fallar.
const fuentesPromise = Promise.all([
  readFile(path.join(process.cwd(), "public", "fuentes", "Manrope-Regular.ttf")),
  readFile(path.join(process.cwd(), "public", "fuentes", "Manrope-ExtraBold.ttf")),
]).catch(() => null);

export async function GET(req: Request) {
  if (!(await esAdmin())) {
    return new Response("No autorizado", { status: 403 });
  }

  const rentaId = new URL(req.url).searchParams.get("renta");
  const hoja = rentaId ? await datosDesdeRenta(rentaId) : null;
  if (!hoja) return new Response("Cotización no encontrada", { status: 404 });

  const [logo, fuentes] = await Promise.all([logoPromise, fuentesPromise]);

  return new ImageResponse(<DocumentoCotizacion hoja={hoja} logo={logo} />, {
    width: ANCHO,
    height: altoDocumento(hoja),
    headers: { "Cache-Control": "private, no-store" },
    ...(fuentes
      ? {
          fonts: [
            { name: "Manrope", data: fuentes[0], weight: 400 as const, style: "normal" as const },
            { name: "Manrope", data: fuentes[1], weight: 800 as const, style: "normal" as const },
          ],
        }
      : {}),
  });
}
