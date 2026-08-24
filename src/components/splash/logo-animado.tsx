import { TEXTO_CLIMAX, TEXTO_PRESS } from "@/lib/splash";

/**
 * El logo de Climaxpress redibujado en SVG, pieza por pieza, para poder
 * animarlo: `public/HD_sinFondo.png` es un bitmap aplanado (sol, rayos,
 * horizonte, las cinco hojas de viento y el texto comparten el mismo canal
 * alfa sobre un degradado), así que no había forma de mover el sol y el viento
 * por separado.
 *
 * Va **sin el disco azul**: el splash es sobre blanco, así que se usa el
 * lockup suelto y el viewBox recorta a lo que ocupa de verdad dentro del disco
 * original (x 103–1362, y 269–1095, más un poco de aire).
 *
 * Toda la geometría de abajo está MEDIDA sobre ese PNG (lienzo 1449×1428), no
 * estimada a ojo: el degradado sale de una regresión lineal sobre el disco, los
 * diecisiete rayos traen su ángulo real (no son uniformes, y alternan largo y
 * corto), y la hoja de viento son dos cúbicas ajustadas a su contorno. El
 * resultado difiere del original en 1.62/255 de media. Si se toca un número hay
 * que volver a comparar contra el PNG (ver CLAUDE.md).
 *
 * Los hex de marca van literales, como en `app/api/cotizacion/documento.tsx`:
 * es arte de marca con colores fijos y no tiene variante para el tema oscuro.
 */

const AMARILLO = "#FAB919";
const MARRON = "#722111";

// Encuadre: lo que ocupa el lockup dentro del lienzo original de 1449×1428,
// con 24 de aire alrededor.
const VISTA = "79 245 1308 875";

// Centro del sol y del abanico de rayos.
const SOL = { x: 683, y: 561 };
// El disco amarillo se corta aquí: el sol está saliendo tras el horizonte.
const CORTE = 580;

// Ángulos reales de cada rayo, en grados (0° = a la derecha, negativo = hacia
// arriba). Los largos y los cortos se alternan.
const RAYOS_LARGOS = [-0.12, -23.1, -45.17, -68.3, -90.01, -113, -135, -158.13, -179.88];
const RAYOS_CORTOS = [-11.49, -34.44, -56.48, -79.63, -101.41, -124.32, -146.28, -169.45];
// Radios de la línea ya descontando el remate redondo del trazo.
const LARGO = { r0: 196.5, r1: 286.5 };
const CORTO = { r0: 202.5, r1: 248.5 };

// Una sola hoja de viento; las otras cuatro son ésta girada.
const HOJA =
  "M322 781.5C383.8 847.4 459.1 889.7 551 888C652.1 887.4 702 838 780 798.5C749.8 882.7 629.5 930.2 551 926C455.8 921.6 378 865 322 781.5Z";
const PIVOTE = { x: 381.5, y: 686.5 };
const HOJAS = [
  { giro: 0, color: "#3871C1" },
  { giro: 24.75, color: "#51ADE5" },
  { giro: 50.75, color: "#3871C1" },
  { giro: 76.5, color: "#51ADE5" },
  { giro: 102.25, color: "#3871C1" },
];

// Los dos reflejos de dentro del disco, como arcos sobre el mismo radio.
const REFLEJOS: [number, number][] = [
  [188, 234.4],
  [174, 186],
];

const polar = (r: number, grados: number) => {
  const a = (grados * Math.PI) / 180;
  return [
    Number((SOL.x + r * Math.cos(a)).toFixed(2)),
    Number((SOL.y + r * Math.sin(a)).toFixed(2)),
  ];
};

const arco = (r: number, desde: number, hasta: number) => {
  const [x1, y1] = polar(r, desde);
  const [x2, y2] = polar(r, hasta);
  return `M${x1} ${y1}A${r} ${r} 0 0 1 ${x2} ${y2}`;
};

// De derecha a izquierda, para que el destello recorra el abanico en orden.
const RAYOS = [
  ...RAYOS_LARGOS.map((ang) => ({ ang, ...LARGO })),
  ...RAYOS_CORTOS.map((ang) => ({ ang, ...CORTO })),
].sort((a, b) => b.ang - a.ang);

export function LogoAnimado({ className }: { className?: string }) {
  return (
    <svg viewBox={VISTA} className={className} role="img" aria-label="Climaxpress">
      <defs>
        <radialGradient id="cx-halo">
          {/* Sobre blanco el amarillo casi no contrasta, así que el halo va
              flojo a propósito: se lee como brillo y no como una mancha. */}
          <stop offset="0" stopColor={AMARILLO} stopOpacity="0.42" />
          <stop offset="0.5" stopColor={AMARILLO} stopOpacity="0.14" />
          <stop offset="1" stopColor={AMARILLO} stopOpacity="0" />
        </radialGradient>
        <clipPath id="cx-corte">
          <rect x="0" y="0" width="1449" height={CORTE} />
        </clipPath>
        <path id="cx-hoja" d={HOJA} />
      </defs>

      {/* El viento: cada hoja entra girando sobre el mismo pivote que el
          remolino real, escalonada por --i. */}
      <g>
        {HOJAS.map((h, i) => (
          <g key={h.giro} className="cx-hoja" style={{ "--i": i } as React.CSSProperties}>
            <g transform={`rotate(${h.giro} ${PIVOTE.x} ${PIVOTE.y})`}>
              <use href="#cx-hoja" fill={h.color} />
            </g>
          </g>
        ))}
      </g>

      {/* El sol y su resplandor, recortados por el horizonte. */}
      <g clipPath="url(#cx-corte)">
        <circle className="cx-halo" cx={SOL.x} cy={SOL.y} r="300" fill="url(#cx-halo)" />
        <g className="cx-sol">
          <circle cx={SOL.x} cy={SOL.y} r="160" fill={AMARILLO} />
          <circle cx={SOL.x} cy={SOL.y} r="166" fill="none" stroke={MARRON} strokeWidth="11" />
          <g fill="none" stroke={MARRON} strokeWidth="12" strokeLinecap="round">
            {REFLEJOS.map(([a, b]) => (
              <path key={a} d={arco(135, a, b)} />
            ))}
          </g>
        </g>
      </g>

      <g stroke={MARRON} strokeWidth="11" strokeLinecap="round">
        {RAYOS.map((r, i) => {
          const [x1, y1] = polar(r.r0, r.ang);
          const [x2, y2] = polar(r.r1, r.ang);
          return (
            <line
              key={r.ang}
              className="cx-rayo"
              style={{ "--i": i } as React.CSSProperties}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
          );
        })}
      </g>

      <rect x="397" y="581" width="573" height="11" fill={MARRON} />

      {/* textLength fija el ancho exacto que ocupa cada palabra en el logo, así
          el renglón cuadra aunque Manrope no sea la tipografía original. */}
      <g
        className="cx-texto"
        fontFamily="var(--font-sans), Manrope, sans-serif"
        fontWeight="800"
        fontSize="155"
      >
        <text x="312" y="754" textLength="578" fill={TEXTO_CLIMAX}>
          ClimaX
        </text>
        <text x="912" y="754" textLength="450" fill={TEXTO_PRESS}>
          press
        </text>
      </g>
    </svg>
  );
}
