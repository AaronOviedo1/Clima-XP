import { prisma } from "@/lib/prisma";
import { bodegaDesdeEnv, type Punto } from "@/lib/ruta";

export const CLAVE_BODEGA_LAT = "bodegaLat";
export const CLAVE_BODEGA_LNG = "bodegaLng";

export type Bodega = { coords: Punto; fuente: "bd" | "env" };

/**
 * Coordenadas de la bodega: primero la tabla Configuracion (editable desde
 * /configuracion), con fallback a env BODEGA_LAT/BODEGA_LNG.
 */
export async function obtenerBodega(): Promise<Bodega | null> {
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: [CLAVE_BODEGA_LAT, CLAVE_BODEGA_LNG] } },
  });
  const lat = parseFloat(filas.find((f) => f.clave === CLAVE_BODEGA_LAT)?.valor ?? "");
  const lng = parseFloat(filas.find((f) => f.clave === CLAVE_BODEGA_LNG)?.valor ?? "");
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { coords: { lat, lng }, fuente: "bd" };
  }
  const env = bodegaDesdeEnv();
  return env ? { coords: env, fuente: "env" } : null;
}

export type DatosConfiguracion = Awaited<ReturnType<typeof datosConfiguracion>>;

export async function datosConfiguracion() {
  const [modelos, tarifas, bodega] = await Promise.all([
    prisma.modeloEquipo.findMany({
      include: { _count: { select: { unidades: true } } },
      orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
    }),
    prisma.zonaEnvio.findMany({ orderBy: { kmMax: "asc" } }),
    obtenerBodega(),
  ]);
  return { modelos, tarifas, bodega };
}
