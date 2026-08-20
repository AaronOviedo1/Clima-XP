import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Modelo del copiloto. El más barato que sirve para esto (elegir una tool,
 * redactar dos frases): Claude Haiku 4.5. Se puede subir sin tocar código con
 * COPILOTO_MODELO (p. ej. "claude-sonnet-5" o "claude-opus-5"); por eso la
 * petición no manda thinking, effort ni temperature —cada familia acepta
 * parámetros distintos y así el cambio de modelo no rompe la llamada.
 */
export const MODELO_COPILOTO = process.env.COPILOTO_MODELO?.trim() || "claude-haiku-4-5";

// Las respuestas son de dos a cinco frases; esto es tope de seguridad y de gasto.
export const MAX_TOKENS_RESPUESTA = 1024;

// Rondas de tool use por pregunta (cada ronda puede traer varias tools en
// paralelo). Con cinco tools de una consulta cada una, más de esto es un bucle.
export const MAX_RONDAS_TOOLS = 4;

// Veces que se le pide reescribir cuando su respuesta trae números que no
// vienen de las tools (ver verificarNumeros en runner.ts). Una suele bastar;
// si reincide, se contesta que no se puede calcular.
export const MAX_REINTENTOS_NUMEROS = 1;

let cliente: Anthropic | null = null;

/**
 * Cliente perezoso: la llave sale del entorno (ANTHROPIC_API_KEY o un perfil
 * de `ant auth login`). Sin credenciales el SDK lanza al construirse; aquí se
 * devuelve null y el route contesta 503 "copiloto no configurado" en vez de
 * tumbar el arranque del servidor.
 */
export function clienteAnthropic(): Anthropic | null {
  if (cliente) return cliente;
  try {
    cliente = new Anthropic({ maxRetries: 1, timeout: 60_000 });
    return cliente;
  } catch {
    return null;
  }
}
