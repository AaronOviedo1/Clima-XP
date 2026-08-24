/**
 * Pantallas de arranque de iOS.
 *
 * iOS no lee el manifest: sin `apple-touch-startup-image` la PWA instalada
 * enseña una pantalla en blanco mientras carga, justo antes del splash animado.
 * Estas son las medidas (en puntos y densidad) de los modelos vigentes; iOS
 * elige la que empate exactamente con el dispositivo, así que cada uno necesita
 * su archivo y su media query.
 *
 * Solo se generan en vertical porque el manifest fija `orientation: portrait`.
 *
 * Esta tabla la usan dos sitios y por eso vive aquí: `scripts/generar-splash.ts`
 * para producir los PNG y `app/layout.tsx` para emitir los <link>.
 */
export type Pantalla = { ancho: number; alto: number; dpr: number };

export const PANTALLAS_IOS: Pantalla[] = [
  // iPhone
  { ancho: 320, alto: 568, dpr: 2 }, // SE (1ª gen)
  { ancho: 375, alto: 667, dpr: 2 }, // 8, SE (2ª/3ª gen)
  { ancho: 414, alto: 736, dpr: 3 }, // 8 Plus
  { ancho: 375, alto: 812, dpr: 3 }, // X, XS, 11 Pro, 12/13 mini
  { ancho: 414, alto: 896, dpr: 2 }, // XR, 11
  { ancho: 414, alto: 896, dpr: 3 }, // XS Max, 11 Pro Max
  { ancho: 390, alto: 844, dpr: 3 }, // 12, 13, 14
  { ancho: 428, alto: 926, dpr: 3 }, // 12/13 Pro Max, 14 Plus
  { ancho: 393, alto: 852, dpr: 3 }, // 14 Pro, 15, 16
  { ancho: 430, alto: 932, dpr: 3 }, // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  { ancho: 402, alto: 874, dpr: 3 }, // 16 Pro
  { ancho: 440, alto: 956, dpr: 3 }, // 16 Pro Max
  // iPad
  { ancho: 768, alto: 1024, dpr: 2 }, // 9.7" / 10.2"
  { ancho: 810, alto: 1080, dpr: 2 }, // 10.2" (9ª gen)
  { ancho: 820, alto: 1180, dpr: 2 }, // Air 10.9" / 10ª gen
  { ancho: 834, alto: 1112, dpr: 2 }, // Air 10.5" / Pro 10.5"
  { ancho: 834, alto: 1194, dpr: 2 }, // Pro 11"
  { ancho: 1024, alto: 1366, dpr: 2 }, // Pro 12.9"
];

export const archivoSplash = ({ ancho, alto, dpr }: Pantalla) =>
  `/splash/${ancho}x${alto}@${dpr}x.png`;

export const mediaSplash = ({ ancho, alto, dpr }: Pantalla) =>
  `(device-width: ${ancho}px) and (device-height: ${alto}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`;

/**
 * Lado del logo dentro de la imagen, en píxeles reales. Replica el
 * `width: min(58vw, 264px)` de `.splash-logo` en globals.css para que el PNG y
 * el primer fotograma del splash animado coincidan y el cambio no se note.
 */
export const ladoLogo = ({ ancho, dpr }: Pantalla) => Math.round(Math.min(ancho * 0.58, 264) * dpr);

/** El azul de `.splash`, `background_color` del manifest y `theme_color`. */
export const FONDO_SPLASH = "#152b47";
