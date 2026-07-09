// Parser de ubicaciones pegadas por el cliente (sin API key):
// - Coordenadas decimales: "29.1023, -111.0096"
// - DMS: 29°06'51.9"N 111°00'34.7"W
// - Links de Google Maps con coords embebidas (@lat,lng / q= / !3d!4d / ll=)
// Los links cortos (maps.app.goo.gl) se expanden en el server (resolverUbicacion).

export type Coordenadas = { lat: number; lng: number };

function valida(lat: number, lng: number): Coordenadas | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

// DMS → decimal
function dmsADecimal(g: string, m: string, s: string, hemi: string): number {
  let dec = parseInt(g) + parseInt(m) / 60 + parseFloat(s) / 3600;
  if (/[SW]/i.test(hemi)) dec = -dec;
  return dec;
}

const RE_DMS =
  /(\d{1,3})°\s*(\d{1,2})['′]\s*([\d.]+)["″'′]?\s*([NSEW])/gi;

const RE_DECIMAL = /(-?\d{1,3}\.\d{3,})\s*[, ]\s*(-?\d{1,3}\.\d{3,})/;

// Patrones de URL de Google Maps con coordenadas.
const RE_URL_PATTERNS = [
  /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, // /maps/@lat,lng,zoom
  /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, // !3dlat!4dlng
  /[?&](?:q|query|ll|destination)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, // ?q=lat,lng
];

export function parseCoordenadas(entrada: string | null | undefined): Coordenadas | null {
  if (!entrada) return null;
  const texto = entrada.trim();

  // 1) URLs de Google Maps
  for (const re of RE_URL_PATTERNS) {
    const m = texto.match(re);
    if (m) {
      const c = valida(parseFloat(m[1]), parseFloat(m[2]));
      if (c) return c;
    }
  }

  // 2) DMS (dos componentes)
  const dms = [...texto.matchAll(RE_DMS)];
  if (dms.length >= 2) {
    const [a, b] = dms;
    const v1 = dmsADecimal(a[1], a[2], a[3], a[4]);
    const v2 = dmsADecimal(b[1], b[2], b[3], b[4]);
    // Ordenar por hemisferio: N/S → lat, E/W → lng
    const esLat = (h: string) => /[NS]/i.test(h);
    const lat = esLat(a[4]) ? v1 : v2;
    const lng = esLat(a[4]) ? v2 : v1;
    const c = valida(lat, lng);
    if (c) return c;
  }

  // 3) Decimal simple
  const dec = texto.match(RE_DECIMAL);
  if (dec) {
    const c = valida(parseFloat(dec[1]), parseFloat(dec[2]));
    if (c) return c;
  }

  return null;
}

export function esLinkCortoMaps(entrada: string | null | undefined): boolean {
  if (!entrada) return false;
  return /https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(entrada.trim());
}

export function esUrl(entrada: string | null | undefined): boolean {
  if (!entrada) return false;
  return /^https?:\/\//i.test(entrada.trim());
}
