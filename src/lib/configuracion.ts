import { prisma } from "@/lib/prisma";
import { bodegaDesdeEnv, type Punto } from "@/lib/ruta";
import {
  CONFIG_FESTIVOS_DEFAULT,
  normalizarFestivos,
  type ConfigFestivos,
} from "@/lib/festivos";

export const CLAVE_BODEGA_LAT = "bodegaLat";
export const CLAVE_BODEGA_LNG = "bodegaLng";
export const CLAVE_FESTIVOS = "festivos";
export const CLAVE_CARGO_FESTIVO = "cargoFestivo";

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

/**
 * Días festivos y cargo por equipo (ver lib/festivos.ts). Sin filas en la BD
 * valen los defaults (24, 25, 31 dic y 1 ene a $100), así el cargo funciona
 * desde el primer deploy. Una lista vacía guardada a propósito apaga el cargo.
 */
export async function obtenerFestivos(): Promise<ConfigFestivos> {
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: [CLAVE_FESTIVOS, CLAVE_CARGO_FESTIVO] } },
  });
  const crudoFechas = filas.find((f) => f.clave === CLAVE_FESTIVOS)?.valor;
  const crudoMonto = filas.find((f) => f.clave === CLAVE_CARGO_FESTIVO)?.valor;

  let fechas = CONFIG_FESTIVOS_DEFAULT.fechas;
  if (crudoFechas != null) {
    try {
      const v: unknown = JSON.parse(crudoFechas);
      if (Array.isArray(v)) fechas = normalizarFestivos(v.map(String));
    } catch {
      // valor corrupto: se quedan los defaults
    }
  }
  const monto = crudoMonto != null ? parseInt(crudoMonto, 10) : NaN;
  return {
    fechas,
    montoPorEquipo:
      Number.isFinite(monto) && monto >= 0 ? monto : CONFIG_FESTIVOS_DEFAULT.montoPorEquipo,
  };
}

export type DatosConfiguracion = Awaited<ReturnType<typeof datosConfiguracion>>;

export async function datosConfiguracion() {
  const [modelos, tarifas, bodega, festivos] = await Promise.all([
    prisma.modeloEquipo.findMany({
      include: { _count: { select: { unidades: true } } },
      orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
    }),
    prisma.zonaEnvio.findMany({ orderBy: { kmMax: "asc" } }),
    obtenerBodega(),
    obtenerFestivos(),
  ]);
  return { modelos, tarifas, bodega, festivos };
}
