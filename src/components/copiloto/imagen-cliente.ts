// Prepara en el navegador la imagen que se adjunta al copiloto (la captura de
// WhatsApp con el pedido). Una captura de iPhone pesa 2–5 MB y el modelo no
// necesita más de ~1568 px de lado para leer texto, así que se reduce y se
// recodifica como JPEG antes de mandarla: el JSON viaja en ~200–400 KB y la
// lectura cuesta lo mismo que una imagen chica. Además sale una miniatura
// aparte para pintarla en la burbuja y guardarla en sessionStorage sin
// cargarlo con la imagen completa.

export const LADO_MAXIMO = 1568;
export const LADO_MINIATURA = 240;
const CALIDAD = 0.85;
const CALIDAD_MINIATURA = 0.7;
// Tope del servidor (MAX_BASE64_IMAGEN); si con la calidad normal se pasara,
// se baja la calidad antes que rechazarla.
const MAX_BASE64 = 4_000_000;

export type ImagenPreparada = {
  tipo: "image/jpeg";
  base64: string; // sin el prefijo data:
  miniatura: string; // data URL chica, para la burbuja
};

function cargarImagen(archivo: Blob): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolver(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error("No pude abrir esa imagen."));
    };
    img.src = url;
  });
}

function dibujar(img: HTMLImageElement, ladoMaximo: number): HTMLCanvasElement {
  const escala = Math.min(1, ladoMaximo / Math.max(img.naturalWidth, img.naturalHeight));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round(img.naturalWidth * escala));
  lienzo.height = Math.max(1, Math.round(img.naturalHeight * escala));
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("No pude procesar la imagen.");
  // Fondo blanco: un PNG con transparencia se volvería negro al pasar a JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  return lienzo;
}

export async function prepararImagen(archivo: Blob): Promise<ImagenPreparada> {
  if (!archivo.type.startsWith("image/")) throw new Error("Solo se pueden adjuntar imágenes.");
  const img = await cargarImagen(archivo);
  const grande = dibujar(img, LADO_MAXIMO);
  let calidad = CALIDAD;
  let dataUrl = grande.toDataURL("image/jpeg", calidad);
  while (dataUrl.length > MAX_BASE64 && calidad > 0.4) {
    calidad -= 0.15;
    dataUrl = grande.toDataURL("image/jpeg", calidad);
  }
  if (dataUrl.length > MAX_BASE64) throw new Error("La imagen es demasiado grande.");
  return {
    tipo: "image/jpeg",
    base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
    miniatura: dibujar(img, LADO_MINIATURA).toDataURL("image/jpeg", CALIDAD_MINIATURA),
  };
}
