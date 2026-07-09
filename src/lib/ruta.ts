// Ordenamiento de paradas de la ruta del día.
// Nearest-neighbor simple desde la bodega cuando hay coordenadas; si no,
// se conserva el orden por ventana/creación (fallback).

export type Punto = { lat: number; lng: number };

// Distancia en km entre dos coordenadas (haversine).
export function haversineKm(a: Punto, b: Punto): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Coordenadas de la bodega desde env (BODEGA_LAT / BODEGA_LNG), o null.
export function bodegaDesdeEnv(): Punto | null {
  const lat = parseFloat(process.env.BODEGA_LAT ?? "");
  const lng = parseFloat(process.env.BODEGA_LNG ?? "");
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

/**
 * Ordena las paradas por cercanía (nearest-neighbor) empezando en la bodega.
 * Las paradas sin coordenadas se dejan al final en su orden original.
 * Si no hay bodega, devuelve el orden recibido.
 */
export function ordenarRuta<T extends { lat: number | null; lng: number | null }>(
  paradas: T[],
  bodega: Punto | null,
): T[] {
  const conCoords = paradas.filter((p): p is T & Punto => p.lat != null && p.lng != null);
  const sinCoords = paradas.filter((p) => p.lat == null || p.lng == null);

  if (!bodega || conCoords.length <= 1) {
    return [...conCoords, ...sinCoords];
  }

  const restantes = [...conCoords];
  const orden: T[] = [];
  let actual: Punto = bodega;
  while (restantes.length) {
    let mejorIdx = 0;
    let mejorD = Infinity;
    for (let i = 0; i < restantes.length; i++) {
      const d = haversineKm(actual, restantes[i] as Punto);
      if (d < mejorD) {
        mejorD = d;
        mejorIdx = i;
      }
    }
    const siguiente = restantes.splice(mejorIdx, 1)[0];
    orden.push(siguiente);
    actual = siguiente as Punto;
  }
  return [...orden, ...sinCoords];
}
