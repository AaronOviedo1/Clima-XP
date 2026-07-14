// Deep links a Google Maps.

// Enlace a un punto (búsqueda): usa coords si existen, si no la dirección.
export function linkMapsPunto(
  direccion: string,
  lat?: number | null,
  lng?: number | null,
): string {
  const query =
    lat != null && lng != null
      ? `${lat},${lng}`
      : encodeURIComponent(direccion);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export type ParadaRuta = {
  direccion: string;
  lat?: number | null;
  lng?: number | null;
};

// Enlace de ruta con múltiples paradas (Google limita a ~10 waypoints por link).
// Devuelve uno o más links; si hay más de 10 paradas, parte en varias rutas.
export function linksRuta(
  paradas: ParadaRuta[],
  origen?: ParadaRuta,
): string[] {
  // Sin encodeURIComponent aquí: URLSearchParams ya codifica los valores
  // (codificar antes produciría doble codificación y Maps mostraría "%20").
  const punto = (p: ParadaRuta) =>
    p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : p.direccion;

  const MAX = 10;
  const links: string[] = [];
  for (let i = 0; i < paradas.length; i += MAX) {
    const lote = paradas.slice(i, i + MAX);
    const destino = lote[lote.length - 1];
    const waypoints = lote.slice(0, -1).map(punto).join("|");
    const params = new URLSearchParams({
      api: "1",
      destination: punto(destino),
    });
    if (origen) params.set("origin", punto(origen));
    if (waypoints) params.set("waypoints", waypoints);
    links.push(`https://www.google.com/maps/dir/?${params.toString()}`);
  }
  return links;
}
