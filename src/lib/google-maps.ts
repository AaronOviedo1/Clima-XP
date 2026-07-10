// Geocoding + Distance Matrix (Fase 4). Solo servidor: usa GOOGLE_MAPS_API_KEY.
// La key debe tener habilitadas Geocoding API y Distance Matrix API.

import type { Coordenadas } from "@/lib/coordenadas";

// Sesgo (no restricción) hacia el área de Hermosillo y alrededores,
// para que direcciones ambiguas resuelvan aquí y no en otra ciudad.
const BOUNDS_HERMOSILLO = "28.85,-111.25|29.35,-110.75";

export function mapsHabilitado(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

export type ResultadoGeocode =
  | { ok: true; coords: Coordenadas; direccionFormateada: string }
  | { ok: false; error: string };

export async function geocodificarDireccion(direccion: string): Promise<ResultadoGeocode> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { ok: false, error: "Falta GOOGLE_MAPS_API_KEY." };

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", direccion);
  url.searchParams.set("bounds", BOUNDS_HERMOSILLO);
  url.searchParams.set("region", "mx");
  url.searchParams.set("language", "es");
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.status === "ZERO_RESULTS") {
      return { ok: false, error: "No se encontró la dirección en el mapa." };
    }
    if (data.status !== "OK" || !data.results?.length) {
      return { ok: false, error: `Geocoding falló (${data.status}).` };
    }
    const r = data.results[0];
    return {
      ok: true,
      coords: { lat: r.geometry.location.lat, lng: r.geometry.location.lng },
      direccionFormateada: r.formatted_address as string,
    };
  } catch {
    return { ok: false, error: "No se pudo consultar el geocoder." };
  }
}

export type ResultadoDistancia =
  | { ok: true; km: number; minutos: number }
  | { ok: false; error: string };

// Distancia manejando (no en línea recta) desde `origen` hasta `destino`.
export async function distanciaKmDesde(
  origen: Coordenadas,
  destino: Coordenadas,
): Promise<ResultadoDistancia> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { ok: false, error: "Falta GOOGLE_MAPS_API_KEY." };

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", `${origen.lat},${origen.lng}`);
  url.searchParams.set("destinations", `${destino.lat},${destino.lng}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("units", "metric");
  url.searchParams.set("language", "es");
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    const elemento = data.rows?.[0]?.elements?.[0];
    if (data.status !== "OK" || !elemento) {
      return { ok: false, error: `Distance Matrix falló (${data.status}).` };
    }
    if (elemento.status !== "OK") {
      return { ok: false, error: `Sin ruta al destino (${elemento.status}).` };
    }
    return {
      ok: true,
      km: elemento.distance.value / 1000,
      minutos: Math.round(elemento.duration.value / 60),
    };
  } catch {
    return { ok: false, error: "No se pudo consultar Distance Matrix." };
  }
}
