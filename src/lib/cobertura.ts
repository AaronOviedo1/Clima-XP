import "server-only";
import { prisma } from "@/lib/prisma";
import type { Coordenadas } from "@/lib/coordenadas";
import { localidadDeCoords, mapsHabilitado, type Localidad } from "@/lib/google-maps";
import { obtenerBodega } from "@/lib/configuracion";

// El negocio solo da servicio en Hermosillo: una dirección de otra ciudad —o a
// una hora de camino, como Bahía de Kino, que es del mismo municipio— no se
// puede atender ni cobrar, porque la tabla de tarifas no llega hasta allá.
//
// Qué se comprueba, y por qué en ese orden:
//
// 1. **La distancia manda.** El área de servicio es hasta donde llega la tabla
//    de domicilio (`ZonaEnvio`, hoy 35 km). Fuera de eso no hay tarifa que
//    cobrar, así que se rechaza.
// 2. **La ciudad solo cuando no se pudo medir.** Google no devuelve el
//    municipio en México: San Pedro El Saucito —comisaría de Hermosillo, a 15
//    km, zona de servicio de siempre— aparece con su propio nombre y sin rastro
//    de Hermosillo. Exigir el nombre rechazaría direcciones buenas, así que
//    solo se usa como respaldo cuando no hay bodega para medir distancia.
//
// Regla importante: **si no se puede verificar, no se bloquea**. Sin API key,
// sin bodega capturada o con Google caído la app tiene que seguir sirviendo
// (mismo criterio degradado de la Fase 4); lo que se rechaza es lo que Google
// confirma que está fuera.

const KM_COBERTURA_SIN_TABLA = 35; // el tope actual de ZonaEnvio
const MARGEN_KM = 1.15; // los km de la tabla son de manejo: un poco de aire

// Hasta dónde llega la tarifa de domicilio. Si se agregan filas en
// /configuracion, la cobertura crece con ellas.
export async function kmMaximosCobertura(): Promise<number> {
  const zona = await prisma.zonaEnvio.findFirst({ orderBy: { kmMax: "desc" } });
  return zona?.kmMax ?? KM_COBERTURA_SIN_TABLA;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function esHermosillo(texto: string | null | undefined): boolean {
  return texto ? normalizar(texto).includes("hermosillo") : false;
}

// Distancia en línea recta, como respaldo cuando no hay km de manejo (sin
// bodega o con Distance Matrix caído). Solo sirve para descartar lo obviamente
// lejano, nunca para cobrar.
function kmEnLineaRecta(a: Coordenadas, b: Coordenadas): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type EntradaCobertura = {
  coords: Coordenadas | null;
  // Localidad que ya devolvió Google al geocodificar la dirección; si no viene
  // y hay coords, se consulta con geocoding inverso.
  localidad?: Localidad | null;
  km?: number | null; // km manejando desde la bodega, si ya se calcularon
};

/**
 * Devuelve el motivo por el que la dirección queda fuera de servicio, o null si
 * está bien (o si no hay forma de saberlo).
 */
export async function motivoFueraDeCobertura(e: EntradaCobertura): Promise<string | null> {
  if (!e.coords) return null; // sin punto en el mapa no hay nada que verificar

  const kmMax = await kmMaximosCobertura();

  // 1) Distancia: manejando si ya se calculó, o en línea recta como respaldo.
  if (e.km != null) {
    if (e.km > kmMax * MARGEN_KM) {
      return `Esa dirección está a ${e.km} km de la bodega y el servicio llega hasta ${kmMax} km. Solo se renta en Hermosillo.`;
    }
    return null; // dentro del área de servicio: no se pide nada más
  }

  const bodega = await obtenerBodega();
  if (bodega) {
    const recta = kmEnLineaRecta(bodega.coords, e.coords);
    if (recta > kmMax) {
      return `Esa dirección está a unos ${Math.round(recta)} km de la bodega y el servicio llega hasta ${kmMax} km. Solo se renta en Hermosillo.`;
    }
    return null;
  }

  // 2) Sin bodega no hay contra qué medir: queda el nombre de la ciudad.
  let localidad = e.localidad ?? null;
  if (!localidad && mapsHabilitado()) {
    const r = await localidadDeCoords(e.coords);
    if (r.ok) localidad = r.localidad;
  }

  const nombre = localidad?.ciudad ?? localidad?.municipio ?? null;
  // Sin nombre no se concluye nada: bloquear a ciegas dejaría fuera
  // direcciones válidas.
  if (!nombre) return null;

  if (!esHermosillo(localidad?.ciudad) && !esHermosillo(localidad?.municipio)) {
    return `Esa dirección está en ${nombre}, fuera de Hermosillo. Solo se renta en Hermosillo.`;
  }
  return null;
}
