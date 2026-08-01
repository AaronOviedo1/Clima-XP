// Geocoding + Distance Matrix (Fase 4). Solo servidor: usa GOOGLE_MAPS_API_KEY.
// La key debe tener habilitadas Geocoding API y Distance Matrix API.

import type { Coordenadas } from "@/lib/coordenadas";

// Sesgo (no restricción) hacia el área de Hermosillo y alrededores,
// para que direcciones ambiguas resuelvan aquí y no en otra ciudad.
const BOUNDS_HERMOSILLO = "28.85,-111.25|29.35,-110.75";

export function mapsHabilitado(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

// Ciudad y municipio del resultado de Google. Se guardan los dos porque las
// comisarías de Hermosillo (San Pedro El Saucito, La Victoria…) traen su propio
// nombre como ciudad y solo el municipio dice que siguen siendo Hermosillo.
export type Localidad = { ciudad: string | null; municipio: string | null };

export type ResultadoGeocode =
  | { ok: true; coords: Coordenadas; direccionFormateada: string; localidad: Localidad }
  | { ok: false; error: string };

type ComponenteDireccion = { long_name: string; types: string[] };

function localidadDe(componentes: ComponenteDireccion[] | undefined): Localidad {
  const porTipo = (t: string) =>
    componentes?.find((c) => c.types?.includes(t))?.long_name ?? null;
  return { ciudad: porTipo("locality"), municipio: porTipo("administrative_area_level_2") };
}

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
      localidad: localidadDe(r.address_components),
    };
  } catch {
    return { ok: false, error: "No se pudo consultar el geocoder." };
  }
}

export type ResultadoLocalidad =
  | { ok: true; localidad: Localidad; direccionFormateada: string | null }
  | { ok: false; error: string };

// Geocoding inverso: en qué ciudad cae un punto. Se usa para las coords que se
// pegan (link de Maps o DMS), donde no hay texto que geocodificar.
export async function localidadDeCoords(coords: Coordenadas): Promise<ResultadoLocalidad> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { ok: false, error: "Falta GOOGLE_MAPS_API_KEY." };

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${coords.lat},${coords.lng}`);
  // Sin `result_type`: Google devuelve del resultado más preciso al más
  // general, así que el primero es la dirección de calle (que es la que se
  // escribe en el campo) y la ciudad sale igual de los componentes.
  url.searchParams.set("language", "es");
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.status === "ZERO_RESULTS") {
      return { ok: true, localidad: { ciudad: null, municipio: null }, direccionFormateada: null };
    }
    if (data.status !== "OK" || !data.results?.length) {
      return { ok: false, error: `Geocoding inverso falló (${data.status}).` };
    }
    // El result_type pide ciudad y municipio; vienen en resultados distintos,
    // así que se juntan los componentes de todos.
    const componentes = (data.results as { address_components: ComponenteDireccion[] }[]).flatMap(
      (r) => r.address_components ?? [],
    );
    return {
      ok: true,
      localidad: localidadDe(componentes),
      direccionFormateada: (data.results[0].formatted_address as string) ?? null,
    };
  } catch {
    return { ok: false, error: "No se pudo consultar el geocoder." };
  }
}

// ---------- Sugerencias de dirección ----------

export type SugerenciaDireccion = {
  // Texto que se guarda como dirección.
  descripcion: string;
  // Segunda línea (colonia, ciudad) cuando la hay.
  detalle: string | null;
  // Coordenadas, si el origen ya las trae (Geocoding); con Places se piden
  // aparte al elegir la sugerencia.
  coords: Coordenadas | null;
  placeId: string | null;
};

// Autocompletado de Google Places. Es el bueno —completa mientras escribes—
// pero requiere "Places API (New)" habilitada en la llave; si está bloqueada
// devuelve null y quien llama cae al geocoder, que sí está activo.
async function sugerenciasDePlaces(texto: string): Promise<SugerenciaDireccion[] | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      cache: "no-store",
      body: JSON.stringify({
        input: texto,
        languageCode: "es",
        regionCode: "MX",
        // Sesgo a Hermosillo: sin esto sugiere calles de todo el país.
        locationBias: {
          circle: { center: { latitude: 29.0729, longitude: -110.9559 }, radius: 40000 },
        },
      }),
    });
    if (!res.ok) return null; // 403 = Places no habilitada en la llave
    const data = await res.json();
    const items = (data.suggestions ?? []) as {
      placePrediction?: {
        placeId: string;
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
        text?: { text: string };
      };
    }[];
    return items
      .filter((s) => s.placePrediction)
      .map((s) => ({
        descripcion:
          s.placePrediction!.structuredFormat?.mainText?.text ??
          s.placePrediction!.text?.text ??
          "",
        detalle: s.placePrediction!.structuredFormat?.secondaryText?.text ?? null,
        coords: null,
        placeId: s.placePrediction!.placeId,
      }))
      .filter((s) => s.descripcion);
  } catch {
    return null;
  }
}

// Plan B: el geocoder devuelve varios resultados para un texto parcial. No
// completa como Places (hay que escribir casi toda la calle), pero ya está
// habilitado y trae las coordenadas de una vez.
async function sugerenciasDeGeocoding(texto: string): Promise<SugerenciaDireccion[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return [];

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", texto);
  url.searchParams.set("bounds", BOUNDS_HERMOSILLO);
  url.searchParams.set("region", "mx");
  url.searchParams.set("language", "es");
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return [];
    return (data.results as {
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }[])
      .slice(0, 5)
      .map((r) => {
        const [principal, ...resto] = r.formatted_address.split(",");
        return {
          descripcion: principal.trim(),
          detalle: resto.join(",").trim() || null,
          coords: { lat: r.geometry.location.lat, lng: r.geometry.location.lng },
          placeId: null,
        };
      });
  } catch {
    return [];
  }
}

export async function sugerenciasDeDireccion(texto: string): Promise<SugerenciaDireccion[]> {
  return (await sugerenciasDePlaces(texto)) ?? (await sugerenciasDeGeocoding(texto));
}

// Coordenadas de una sugerencia de Places (las de Geocoding ya vienen).
export async function coordenadasDePlace(placeId: string): Promise<Coordenadas | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=es`,
      { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "location" }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data.location;
    return loc ? { lat: loc.latitude, lng: loc.longitude } : null;
  } catch {
    return null;
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
