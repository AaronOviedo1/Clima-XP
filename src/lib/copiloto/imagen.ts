import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MODELO_COPILOTO } from "./modelo";

// Imágenes en el chat (la captura de WhatsApp con el pedido). No hay un OCR
// aparte: el mismo modelo del copiloto la LEE en un paso previo y devuelve el
// texto literal; ese texto se trata como algo que dijo la persona (entra al
// mensaje del usuario y, con él, al control numérico), el modelo de la
// conversación nunca ve la imagen y la persona ve en el chat qué se leyó. Así
// los números de la captura (cantidades, teléfono, fechas) respaldan la
// propuesta igual que si se hubieran tecleado, y una lectura equivocada se
// cacha antes de confirmar.

export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type TipoImagen = (typeof TIPOS_IMAGEN)[number];

// ~3 MB de imagen (base64 infla 4/3). El widget la reduce a 1568 px de lado
// antes de mandarla, así que lo normal son 150–400 KB; esto es tope de seguridad.
export const MAX_BASE64_IMAGEN = 4_000_000;
// Una captura larga de chat son unas 400 palabras; esto es tope de gasto.
export const MAX_TOKENS_LECTURA = 2048;
// La lectura que se conserva en el historial (y se manda de vuelta como texto).
export const MAX_LECTURA = 4000;
export const SIN_TEXTO = "(sin texto legible)";
// Con esta etiqueta entra la lectura al mensaje del usuario; la regla 9 del
// prompt le dice al modelo qué es y cómo tratarla.
export const ETIQUETA_LECTURA = "[Texto leído de la imagen adjunta]";

export const imagenSchema = z.strictObject({
  tipo: z.enum(TIPOS_IMAGEN),
  base64: z
    .string()
    .min(64)
    .max(MAX_BASE64_IMAGEN, "La imagen es demasiado grande.")
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "La imagen debe venir en base64."),
});
export type ImagenAdjunta = z.infer<typeof imagenSchema>;

const PROMPT_LECTURA = `Eres un transcriptor de capturas de pantalla para un negocio de renta de aerocoolers y calentones en Hermosillo, Sonora. Devuelve ÚNICAMENTE el texto que se ve en la imagen, literal y en orden de lectura, sin interpretar, resumir, corregir, traducir ni completar nada.
- Si es una conversación de chat (WhatsApp u otro), escribe primero el nombre o número del contacto que aparece en el encabezado (si se ve) y luego cada mensaje en su propia línea, con el prefijo "Cliente:" para los recibidos (burbujas claras, a la izquierda) y "Negocio:" para los enviados (burbujas verdes, a la derecha); incluye la hora o fecha del mensaje si se ve.
- Conserva teléfonos, fechas, cantidades, precios y direcciones exactamente como aparecen.
- Si una palabra no se lee bien, escribe [ilegible] en su lugar; no adivines.
- Si no hay texto legible, responde exactamente: ${SIN_TEXTO}
No agregues comentarios, títulos ni explicaciones.`;

export type Lectura = { texto: string; tokensEntrada: number; tokensSalida: number };

/**
 * Lee la imagen con el modelo y devuelve el texto tal cual se ve. Los errores
 * del API suben sin tocar: el runner los mapea igual que los de la conversación.
 */
export async function leerImagen(cliente: Anthropic, imagen: ImagenAdjunta): Promise<Lectura> {
  const r = await cliente.messages.create({
    model: MODELO_COPILOTO,
    max_tokens: MAX_TOKENS_LECTURA,
    system: PROMPT_LECTURA,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: imagen.tipo, data: imagen.base64 } },
          { type: "text", text: "Transcribe esta imagen." },
        ],
      },
    ],
  });
  const texto = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim()
    .slice(0, MAX_LECTURA);
  return {
    texto: texto || SIN_TEXTO,
    tokensEntrada:
      r.usage.input_tokens + (r.usage.cache_creation_input_tokens ?? 0) + (r.usage.cache_read_input_tokens ?? 0),
    tokensSalida: r.usage.output_tokens,
  };
}

/**
 * Lo que el modelo de la conversación recibe como mensaje de la persona: su
 * texto y, si adjuntó imagen, la lectura etiquetada. La misma cadena siembra
 * el control numérico, así que lo que venga en la captura respalda la propuesta.
 */
export function contenidoUsuario(m: { texto: string; lectura?: string }): string {
  if (!m.lectura) return m.texto;
  const cabeza = m.texto || "(Adjunté una imagen, sin más texto.)";
  return `${cabeza}\n\n${ETIQUETA_LECTURA}\n${m.lectura}`;
}
