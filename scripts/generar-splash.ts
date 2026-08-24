/**
 * Genera las pantallas de arranque de iOS para la PWA.
 *
 *   npx tsx scripts/generar-splash.ts
 *
 * Fuente: public/HD_sinFondo.png (el disco del logo, con transparencia afuera),
 * centrado sobre el azul de marca. El logo se dibuja al mismo tamaño relativo
 * que en el splash animado (ver `ladoLogo`), así el PNG que pinta iOS y el
 * primer fotograma del splash empalman sin salto.
 *
 * Salida: public/splash/<ancho>x<alto>@<dpr>x.png, uno por modelo de la tabla
 * de src/lib/splash-ios.ts. Van a public/ y terminan en .png a propósito: el
 * matcher de src/proxy.ts exime las rutas .png, así que se sirven sin sesión
 * (con cualquier otra extensión el redirect al login los rompería en silencio).
 *
 * sharp viene instalado con Next.js.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { FONDO_SPLASH, PANTALLAS_IOS, archivoSplash, ladoLogo } from "@/lib/splash-ios";

const LOGO = "public/HD_sinFondo.png";

async function main() {
  await mkdir("public/splash", { recursive: true });

  for (const p of PANTALLAS_IOS) {
    const w = p.ancho * p.dpr;
    const h = p.alto * p.dpr;
    const lado = ladoLogo(p);
    const logo = await sharp(LOGO).trim().resize(lado, lado, { fit: "fill" }).png().toBuffer();

    const destino = `public${archivoSplash(p)}`;
    await sharp({ create: { width: w, height: h, channels: 3, background: FONDO_SPLASH } })
      .composite([
        { input: logo, left: Math.round((w - lado) / 2), top: Math.round((h - lado) / 2) },
      ])
      // Paleta: es un fondo plano y un disco con degradado, así que 128
      // entradas bastan y el archivo baja de cientos de KB a unas decenas.
      .png({ palette: true, colors: 128, effort: 10, compressionLevel: 9 })
      .toFile(destino);
    console.log(`${destino}  ${w}×${h}`);
  }
}

main();
