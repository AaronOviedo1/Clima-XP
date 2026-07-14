/**
 * Genera los iconos de la PWA a partir del logo circular de Climaxpress.
 *
 *   node scripts/generar-iconos.mjs
 *
 * Fuente: public/HD_sinFondo.png (logo circular sobre el degradado azul de marca).
 *
 * El logo es un disco: al montarlo sobre un cuadro se vería el canto del círculo.
 * En vez de dibujar un degradado nuevo detrás (que no empalma con el del logo),
 * se extiende el degradado del propio disco hacia afuera: cada pixel de fuera
 * copia el color del borde del disco en su mismo ángulo. El azul queda continuo
 * hasta las esquinas y el canto desaparece.
 *
 * Salida:
 *   src/app/icon.png              favicon / <link rel="icon">
 *   src/app/apple-icon.png        pantalla de inicio de iOS (opaco; iOS aplica su máscara)
 *   public/icons/icon-{192,512}.png            purpose "any"
 *   public/icons/icon-maskable-{192,512}.png   purpose "maskable": Android recorta a un
 *                                 círculo, así que el logo se encoge a la zona segura (80%)
 *
 * sharp viene instalado con Next.js; si algún día falta: npm i -D sharp
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const LOGO = "public/HD_sinFondo.png";
const LADO = 1024; // se genera en grande y se reescala a cada tamaño

/** Disco del logo, recortado a su caja y llevado a un cuadrado de `lado`. */
async function disco(lado) {
  const recortado = await sharp(LOGO).trim().toBuffer();
  return sharp(recortado).resize(lado, lado, { fit: "fill" }).ensureAlpha().png().toBuffer();
}

/**
 * Cuadro completo de azul: el disco al `ocupacion` del lado y, afuera, el color
 * del borde del disco prolongado radialmente. El fondo se desenfoca (la
 * prolongación deja estrías radiales) y encima se vuelve a montar el disco nítido.
 */
async function lienzo(ocupacion) {
  const d = Math.round(LADO * ocupacion);
  const img = await disco(d);
  const px = await sharp(img).raw().toBuffer();
  const centro = (LADO - 1) / 2;
  const r = d / 2;
  const borde = r - 2; // se muestrea un poco adentro para no agarrar el antialias del canto

  const fondo = Buffer.alloc(LADO * LADO * 4);
  // color del disco en coordenadas propias (cx, cy relativas a su centro)
  const color = (cx, cy) => {
    const x = Math.min(d - 1, Math.max(0, Math.round(cx + r)));
    const y = Math.min(d - 1, Math.max(0, Math.round(cy + r)));
    return (y * d + x) * 4;
  };

  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < LADO; x++) {
      const dx = x - centro;
      const dy = y - centro;
      const dist = Math.hypot(dx, dy);
      const factor = dist <= borde ? 1 : borde / dist;
      const i = color(dx * factor, dy * factor);
      const o = (y * LADO + x) * 4;
      fondo[o] = px[i];
      fondo[o + 1] = px[i + 1];
      fondo[o + 2] = px[i + 2];
      fondo[o + 3] = 255; // opaco: un icono con transparencia se ve mal en iOS
    }
  }

  const desenfocado = await sharp(fondo, { raw: { width: LADO, height: LADO, channels: 4 } })
    .blur(24)
    .png()
    .toBuffer();
  return sharp(desenfocado)
    .composite([{ input: img, left: Math.round((LADO - d) / 2), top: Math.round((LADO - d) / 2) }])
    .png()
    .toBuffer();
}

/** Recorta las esquinas del cuadro (para el favicon y los iconos "any"). */
const redondear = (tam) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}">` +
      `<rect width="${tam}" height="${tam}" rx="${Math.round(tam * 0.2)}" fill="#fff"/></svg>`
  );

async function escribir(destino, base, tam, { esquinasRedondeadas = false } = {}) {
  let img = sharp(base).resize(tam, tam);
  if (esquinasRedondeadas) {
    img = sharp(
      await img
        .composite([{ input: redondear(tam), blend: "dest-in" }])
        .png()
        .toBuffer()
    );
  }
  await img.png().toFile(destino);
  console.log(destino);
}

await mkdir("public/icons", { recursive: true });

const lleno = await lienzo(1); // el disco al ras del cuadro
const seguro = await lienzo(0.78); // maskable: el logo dentro de la zona segura

await escribir("src/app/icon.png", lleno, 512, { esquinasRedondeadas: true });
await escribir("src/app/apple-icon.png", lleno, 180); // iOS redondea por su cuenta
await escribir("public/icons/icon-192.png", lleno, 192, { esquinasRedondeadas: true });
await escribir("public/icons/icon-512.png", lleno, 512, { esquinasRedondeadas: true });
await escribir("public/icons/icon-maskable-192.png", seguro, 192);
await escribir("public/icons/icon-maskable-512.png", seguro, 512);
