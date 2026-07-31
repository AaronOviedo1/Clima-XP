import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { esAdmin } from "@/lib/auth-guard";
import { fechaDesdeInput } from "@/lib/fechas";
import { datosDesdeRenta, datosDesdeSeleccion } from "@/lib/cotizacion";
import { ANCHO, altoDocumento, DocumentoCotizacion } from "./documento";

// Hoja de cotización como PNG, para mandársela al cliente por WhatsApp.
//
// Dos formas de pedirla:
//   ?renta=<id>                       cotización ya guardada (precios del snapshot)
//   ?u=<ids,coma>&i=&f=&dom=&desc=…   cotización que no se guardó (precios vigentes)
//
// La URL nunca lleva importes: solo qué se cotiza. Los precios los pone el
// servidor, así que nadie puede fabricar una hoja con números inventados.
//
// La ruta NO debe terminar en .png: el matcher de proxy.ts exime las rutas .png
// (los iconos de la PWA se piden sin cookies) y la hoja quedaría pública.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RUTA_LOGO = ["public", "HD_sinFondo.png"];
const RUTA_FUENTES = [
  ["public", "fuentes", "Manrope-Regular.ttf"],
  ["public", "fuentes", "Manrope-ExtraBold.ttf"],
];

function leerArchivo(partes: string[]): Promise<Buffer> {
  return readFile(path.join(process.cwd(), ...partes));
}

// Los assets no cambian: se leen una vez por instancia (la lambda caliente los
// reusa). Si el logo faltara, la hoja se dibuja sin él antes que fallar.
const logoPromise = leerArchivo(RUTA_LOGO)
  .then((b) => `data:image/png;base64,${b.toString("base64")}`)
  .catch(() => null);

const fuentesPromise = Promise.all(RUTA_FUENTES.map(leerArchivo)).catch(() => null);

function entero(valor: string | null): number {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  if (!(await esAdmin())) {
    return new Response("No autorizado", { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  const rentaId = params.get("renta");

  let hoja = null;
  if (rentaId) {
    hoja = await datosDesdeRenta(rentaId);
  } else {
    const unidadIds = (params.get("u") ?? "").split(",").filter(Boolean);
    const inicio = params.get("i");
    const fin = params.get("f");
    if (unidadIds.length && inicio && fin && ES_FECHA.test(inicio) && ES_FECHA.test(fin)) {
      const km = Number(params.get("km"));
      hoja = await datosDesdeSeleccion({
        unidadIds,
        fechaInicio: fechaDesdeInput(inicio),
        fechaFin: fechaDesdeInput(fin),
        costoDomicilio: entero(params.get("dom")),
        distanciaKm: Number.isFinite(km) && km > 0 ? km : null,
        descuentoMonto: entero(params.get("desc")),
        cliente: params.get("cli")?.trim() || null,
      });
    }
  }

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
