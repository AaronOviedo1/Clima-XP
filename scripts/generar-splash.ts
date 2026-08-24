/**
 * Genera las pantallas de arranque de iOS para la PWA.
 *
 *   npx tsx scripts/generar-splash.ts
 *
 * Fuente: public/logo climaxpress.png, que es el logo **sin el disco azul** y
 * con transparencia — el mismo lockup que dibuja el splash animado.
 *
 * Ese archivo está pensado para ir sobre azul: su "press" es blanco y su
 * "ClimaX" un celeste que sobre blanco no se lee. Aquí se recolorean las dos
 * palabras a los tonos oscuros de la marca, los mismos que usa el SVG (ver
 * TEXTO_CLIMAX / TEXTO_PRESS en src/lib/splash.ts). El recoloreo respeta el
 * canal alfa, así que el suavizado de los bordes se conserva; y solo toca al
 * texto porque esos dos colores no aparecen en ninguna otra pieza (las hojas
 * del viento son #3871C1 y #51ADE5).
 *
 * El logo se dibuja al mismo tamaño relativo que en el splash animado (ver
 * `anchoLogo`), así el PNG que pinta iOS y el primer fotograma del splash
 * empalman sin salto.
 *
 * Salida: public/splash/<ancho>x<alto>@<dpr>x.png, uno por modelo de la tabla
 * de src/lib/splash.ts. Van a public/ y terminan en .png a propósito: el
 * matcher de src/proxy.ts exime las rutas .png, así que se sirven sin sesión
 * (con cualquier otra extensión el redirect al login los rompería en silencio).
 *
 * sharp viene instalado con Next.js.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import {
  FONDO_SPLASH,
  PANTALLAS_IOS,
  TEXTO_CLIMAX,
  TEXTO_CLIMAX_ORIGINAL,
  TEXTO_PRESS,
  TEXTO_PRESS_ORIGINAL,
  anchoLogo,
  archivoSplash,
} from "@/lib/splash";

const LOGO = "public/logo climaxpress.png";

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Cambia los colores del texto conservando el alfa (y con él, el suavizado). */
async function conTextoLegible() {
  const { data, info } = await sharp(LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cambios = [
    [rgb(TEXTO_CLIMAX_ORIGINAL), rgb(TEXTO_CLIMAX)],
    [rgb(TEXTO_PRESS_ORIGINAL), rgb(TEXTO_PRESS)],
  ] as const;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    for (const [de, a] of cambios) {
      // Tolerancia corta: los bordes suavizados guardan el color pleno y solo
      // bajan de alfa, así que no hace falta más.
      if (Math.abs(data[i] - de[0]) < 10 && Math.abs(data[i + 1] - de[1]) < 10 && Math.abs(data[i + 2] - de[2]) < 10) {
        [data[i], data[i + 1], data[i + 2]] = a;
        break;
      }
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

async function main() {
  await mkdir("public/splash", { recursive: true });
  const lockup = await sharp(await conTextoLegible()).trim().toBuffer();
  const { width: lw = 1, height: lh = 1 } = await sharp(lockup).metadata();

  for (const p of PANTALLAS_IOS) {
    const w = p.ancho * p.dpr;
    const h = p.alto * p.dpr;
    const ancho = anchoLogo(p);
    const alto = Math.round((ancho * lh) / lw);
    const logo = await sharp(lockup).resize(ancho, alto).png().toBuffer();

    const destino = `public${archivoSplash(p)}`;
    await sharp({ create: { width: w, height: h, channels: 3, background: FONDO_SPLASH } })
      .composite([{ input: logo, left: Math.round((w - ancho) / 2), top: Math.round((h - alto) / 2) }])
      // Paleta: es un fondo plano y un logo de pocos tonos, así que 128
      // entradas bastan y el archivo baja de cientos de KB a unas decenas.
      .png({ palette: true, colors: 128, effort: 10, compressionLevel: 9 })
      .toFile(destino);
    console.log(`${destino}  ${w}×${h}`);
  }
}

main();
