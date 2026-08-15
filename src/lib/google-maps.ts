// Geocoding + Distance Matrix (Fase 4). Solo servidor: usa GOOGLE_MAPS_API_KEY.
// La key debe tener habilitadas Geocoding API y Distance Matrix API.

import { kmEnLineaRecta, type Coordenadas } from "@/lib/coordenadas";

// Sesgo (no restricción) hacia el área de Hermosillo y alrededores,
// para que direcciones ambiguas resuelvan aquí y no en otra ciudad.
const BOUNDS_HERMOSILLO = "28.85,-111.25|29.35,-110.75";

// El autocompletado solo ofrece direcciones dentro del área de servicio: un
// círculo alrededor de la bodega, del tamaño que diga la tabla de tarifas.
// Quien llama lo calcula (`areaDeSugerencias` en cobertura.ts, que sí lee la
// BD) y lo pasa; aquí solo se traduce al formato de cada API.
export type AreaSugerencias = { centro: Coordenadas; radioMetros: number };

// Defensa de respaldo por si el círculo se quedara corto: Google escribe el
// estado en toda predicción mexicana ("…, Hermosillo, Son., México"). La coma
// antes del nombre es a propósito — sin ella, una "Calle Sonora" de cualquier
// otro estado pasaría el filtro.
const ESTADO_SONORA = /,\s*son(ora|\.)\s*(,|$)/i;

// Ordena las sugerencias sin cambiar cuáles son: las de Hermosillo primero.
// Restringir el área obliga a soltar el sesgo de Places hacia la ciudad (los
// dos parámetros son excluyentes), y sin esto "Calle Yáñez" empezaba a sugerir
// las comisarías antes que las cuatro calles de Hermosillo con ese nombre.
function hermosilloPrimero(sugerencias: SugerenciaDireccion[]): SugerenciaDireccion[] {
  const esLocal = (s: SugerenciaDireccion) =>
    /hermosillo/i.test(`${s.descripcion} ${s.detalle ?? ""}`) ? 0 : 1;
  return [...sugerencias].sort((a, b) => esLocal(a) - esLocal(b));
}

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
async function sugerenciasDePlaces(
  texto: string,
  area: AreaSugerencias,
): Promise<SugerenciaDireccion[] | null> {
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
        includedRegionCodes: ["mx"],
        // Solo el área de servicio. Es restricción, no sesgo: `locationBias` y
        // `locationRestriction` son excluyentes y aquí manda el segundo.
        locationRestriction: {
          circle: {
            center: { latitude: area.centro.lat, longitude: area.centro.lng },
            radius: area.radioMetros,
          },
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
      .flatMap((s) => (s.placePrediction ? [s.placePrediction] : []))
      // El filtro de estado va sobre la predicción completa: `mainText` es solo
      // la calle y ahí nunca aparece "Son.".
      .filter((p) =>
        ESTADO_SONORA.test(
          p.text?.text ??
            [p.structuredFormat?.mainText?.text, p.structuredFormat?.secondaryText?.text]
              .filter(Boolean)
              .join(", "),
        ),
      )
      .map((p) => ({
        descripcion: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        detalle: p.structuredFormat?.secondaryText?.text ?? null,
        coords: null,
        placeId: p.placeId,
      }))
      .filter((s) => s.descripcion);
  } catch {
    return null;
  }
}

// Places "clásica" (maps.googleapis.com). Es la que funciona hoy con la llave
// del negocio: la versión New responde 403 aunque aparezca seleccionada en las
// restricciones. Completa igual de bien desde las primeras letras.
async function sugerenciasDePlacesLegacy(
  texto: string,
  area: AreaSugerencias,
): Promise<SugerenciaDireccion[] | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", texto);
  url.searchParams.set("language", "es");
  url.searchParams.set("components", "country:mx");
  // Solo el área de servicio (reemplaza al sesgo `location`+`radius`, que son
  // excluyentes con la restricción). Verificado contra la API: fuera del
  // círculo devuelve ZERO_RESULTS en vez de calles de otra ciudad.
  url.searchParams.set(
    "locationrestriction",
    `circle:${area.radioMetros}@${area.centro.lat},${area.centro.lng}`,
  );
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.status === "ZERO_RESULTS") return [];
    if (data.status !== "OK") return null; // REQUEST_DENIED → sin permiso
    return (data.predictions as {
      place_id: string;
      structured_formatting?: { main_text?: string; secondary_text?: string };
      description: string;
    }[])
      // El filtro va antes del recorte: con él después, una predicción de
      // fuera se comería uno de los cinco lugares.
      .filter((p) => ESTADO_SONORA.test(p.description))
      .slice(0, 5)
      .map((p) => ({
        descripcion: p.structured_formatting?.main_text ?? p.description,
        detalle: p.structured_formatting?.secondary_text ?? null,
        coords: null,
        placeId: p.place_id,
      }));
  } catch {
    return null;
  }
}

// Plan C: el geocoder devuelve varios resultados para un texto parcial. No
// completa como Places (hay que escribir casi toda la calle), pero ya está
// habilitado y trae las coordenadas de una vez.
async function sugerenciasDeGeocoding(
  texto: string,
  area: AreaSugerencias,
): Promise<SugerenciaDireccion[]> {
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
      // El geocoder no acepta restricción (su `bounds` es solo sesgo), pero a
      // cambio devuelve las coordenadas: se mide contra el mismo círculo que
      // usan las otras dos fuentes, que además es exacto.
      .filter(
        (r) =>
          kmEnLineaRecta(area.centro, {
            lat: r.geometry.location.lat,
            lng: r.geometry.location.lng,
          }) *
            1000 <=
          area.radioMetros,
      )
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

// Se intenta la mejor primero y se cae a la siguiente cuando la llave no tiene
// permiso: Places (New) → Places clásica → geocoder. Así la app funciona con lo
// que esté habilitado y mejora sola si se habilita más. Las tres devuelven ya
// solo direcciones del área de servicio; aquí únicamente se acomodan.
export async function sugerenciasDeDireccion(
  texto: string,
  area: AreaSugerencias,
): Promise<SugerenciaDireccion[]> {
  return hermosilloPrimero(
    (await sugerenciasDePlaces(texto, area)) ??
      (await sugerenciasDePlacesLegacy(texto, area)) ??
      (await sugerenciasDeGeocoding(texto, area)),
  );
}

// Coordenadas de una sugerencia de Places (las del geocoder ya vienen). Mismo
// escalonado que las sugerencias: New primero, clásica después.
export async function coordenadasDePlace(placeId: string): Promise<Coordenadas | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=es`,
      { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "location" }, cache: "no-store" },
    );
    if (res.ok) {
      const data = await res.json();
      if (data.location) return { lat: data.location.latitude, lng: data.location.longitude };
    }
  } catch {
    // sigue con la clásica
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "geometry");
  url.searchParams.set("language", "es");
  url.searchParams.set("key", key);
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    const loc = data.result?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
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
