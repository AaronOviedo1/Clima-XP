import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ContextoCopiloto } from "./contexto";
import { buscarTool, toolsParaRol } from "./registro";
import { ArgsInvalidos } from "./tool";
import { seccionFechas, systemPrompt } from "./prompt";
import {
  clienteAnthropic,
  MAX_REINTENTOS_NUMEROS,
  MAX_RONDAS_TOOLS,
  MAX_TOKENS_RESPUESTA,
  MODELO_COPILOTO,
} from "./modelo";

// Lo que manda el cliente: la conversación tal cual se ve en el widget. Solo
// texto de usuario y asistente; los resultados de tools de turnos anteriores
// NO se reenvían: cada dato se vuelve a consultar en el turno en que se cita
// (regla 1 del system prompt), así nunca se responde con números viejos.
export const mensajeChatSchema = z.strictObject({
  rol: z.enum(["usuario", "asistente"]),
  texto: z.string().trim().min(1).max(2000),
});
export type MensajeChat = z.infer<typeof mensajeChatSchema>;

export const mensajesSchema = z
  .array(mensajeChatSchema)
  .min(1)
  .max(20)
  .refine((m) => m.at(-1)?.rol === "usuario", "El último mensaje debe ser del usuario.");

export type ResultadoRunner = {
  respuesta: string;
  toolsLlamadas: string[]; // en orden, cada vez que el modelo llamó una (aunque fallara)
  tokensEntrada: number; // input + caché leída + caché escrita, sumados en todas las rondas
  tokensSalida: number;
  error?: string; // fallo parcial que no impidió responder (tool caída, tope de rondas, números sin respaldo…)
};

/**
 * Error con el que el runner le dice al route qué contestar: `status` y
 * mensaje para el usuario; `detalle` va a la bitácora, no al cliente.
 */
export class ErrorCopiloto extends Error {
  constructor(
    public readonly status: number,
    mensaje: string,
    public readonly detalle: string,
  ) {
    super(mensaje);
    this.name = "ErrorCopiloto";
  }
}

export const RESPUESTA_SIN_CALCULAR =
  "No puedo responder eso sin calcular números por mi cuenta, y no me está permitido: solo puedo citar cifras tal cual vienen del sistema. Pregúntame por un periodo o dato concreto (por ejemplo «¿cuánto facturé en 2026?» o «¿cuánto me debe X?»).";

// Las tools del rol en el formato del API. `$schema` sobra; lo demás es el
// JSON Schema que ya sirve el GET de /api/copiloto.
function toolsParaModelo(ctx: ContextoCopiloto): Anthropic.Tool[] {
  return toolsParaRol(ctx.rol).map((t) => {
    const schema = z.toJSONSchema(t.args) as Record<string, unknown>;
    delete schema.$schema;
    return {
      name: t.nombre,
      description: t.descripcion,
      input_schema: schema as Anthropic.Tool.InputSchema,
    };
  });
}

function aMessageParams(mensajes: MensajeChat[]): Anthropic.MessageParam[] {
  // El primer mensaje debe ser del usuario: un saludo inicial del asistente se descarta.
  const desde = mensajes.findIndex((m) => m.rol === "usuario");
  return mensajes.slice(desde).map((m) => ({
    role: m.rol === "usuario" ? "user" : "assistant",
    content: m.texto,
  }));
}

// ---------- Control numérico (regla 3 del diseño, aplicada por código) ----------
//
// El modelo no debe calcular: cada número de su respuesta tiene que venir de
// un resultado de tool de este turno (o de la propia pregunta, o de la sección
// de fechas del prompt). Se comparan como números ("$17,190" ≈ 17190; "08" ≈ 8),
// tomando cada corrida de dígitos por separado, así "2026-08-22" respalda
// "22 de agosto". Es un respaldo al prompt, no un sustituto: atrapa sumas,
// promedios y cifras inventadas; los números chicos (1, 2, 20…) casi siempre
// aparecen en algún resultado, y eso se acepta.

const RE_NUMERO = /\d+(?:[.,]\d+)*/g;
// Teléfonos, fechas ISO y códigos largos se quitan de la respuesta antes de
// revisarla: el modelo los parte con espacios ("662 228 8418") y no es lo que
// se quiere vigilar.
const RE_SECUENCIA_LARGA = /\+?\d[\d .-]{8,}\d/g;

export function numerosEn(texto: string): Set<string> {
  const out = new Set<string>();
  for (const m of texto.match(RE_NUMERO) ?? []) {
    const n = Number(m.replace(/,/g, ""));
    if (!Number.isNaN(n)) out.add(String(n));
  }
  return out;
}

export function numerosSinRespaldo(respuesta: string, permitidos: Set<string>): string[] {
  const limpia = respuesta.replace(RE_SECUENCIA_LARGA, " ");
  return [...numerosEn(limpia)].filter((n) => !permitidos.has(n));
}

function mensajeCorreccion(faltantes: string[]): string {
  return `[Control automático] Tu respuesta anterior incluye números que NO vienen de las tools de este turno: ${faltantes.join(", ")}. No está permitido sumar, promediar, restar ni derivar cifras. Vuelve a responder usando únicamente números devueltos por las tools (puedes llamarlas otra vez si hace falta); si lo que piden requiere calcular, di que no puedes calcularlo y ofrece los datos tal cual vienen. Responde directamente a la pregunta original, sin mencionar esta corrección ni disculparte.`;
}

// Ejecuta una tool pedida por el modelo y devuelve el tool_result. Un arg malo
// o una tool que no existe para el rol se le regresa como error para que
// corrija; una excepción de verdad también, pero sin el detalle interno.
async function ejecutarParaModelo(
  bloque: Anthropic.ToolUseBlock,
  ctx: ContextoCopiloto,
  errores: string[],
): Promise<Anthropic.ToolResultBlockParam> {
  const resultado = (content: string, is_error = false): Anthropic.ToolResultBlockParam => ({
    type: "tool_result",
    tool_use_id: bloque.id,
    content,
    is_error,
  });
  const tool = buscarTool(bloque.name, ctx.rol);
  if (!tool) return resultado(`La tool ${bloque.name} no está disponible para este usuario.`, true);

  const args = tool.args.safeParse(bloque.input ?? {});
  if (!args.success) {
    return resultado(`Argumentos inválidos: ${args.error.issues[0]?.message ?? "revisa los argumentos."}`, true);
  }
  try {
    const salida = await tool.ejecutar(args.data, ctx);
    return resultado(JSON.stringify(salida));
  } catch (e) {
    if (e instanceof ArgsInvalidos) return resultado(`Argumentos inválidos: ${e.message}`, true);
    const detalle = e instanceof Error ? e.message : "error desconocido";
    errores.push(`${bloque.name}: ${detalle}`);
    console.error(`[copiloto] la tool ${bloque.name} falló:`, e);
    return resultado("La consulta falló por un error interno; no insistas con los mismos argumentos.", true);
  }
}

/**
 * Una pregunta → una respuesta. Loop manual de tool use (no el tool runner
 * beta del SDK): aquí hace falta contar tokens por ronda, registrar qué tools
 * se llamaron, topar las rondas, devolverle al modelo los errores de args y
 * pasar la respuesta por el control numérico.
 */
export async function responderPregunta(
  ctx: ContextoCopiloto,
  mensajes: MensajeChat[],
): Promise<ResultadoRunner> {
  const cliente = clienteAnthropic();
  if (!cliente) {
    throw new ErrorCopiloto(503, "El copiloto no está configurado.", "sin credenciales de Anthropic");
  }

  const tools = toolsParaModelo(ctx);
  const system = systemPrompt(ctx);
  const historial = aMessageParams(mensajes);
  const toolsLlamadas: string[] = [];
  const errores: string[] = [];
  let tokensEntrada = 0;
  let tokensSalida = 0;

  // Números con respaldo: la pregunta del usuario, las fechas del prompt y, a
  // medida que lleguen, los resultados de las tools.
  const permitidos = numerosEn(
    mensajes.filter((m) => m.rol === "usuario").map((m) => m.texto).join(" ") + " " + seccionFechas(ctx.hoy),
  );

  try {
    let respuesta: Anthropic.Message | null = null;
    let rondasTools = 0;
    let reintentosNumeros = 0;
    let sinRespaldo: string[] = [];

    while (true) {
      respuesta = await cliente.messages.create({
        model: MODELO_COPILOTO,
        max_tokens: MAX_TOKENS_RESPUESTA,
        system,
        tools,
        messages: historial,
      });
      tokensEntrada +=
        respuesta.usage.input_tokens +
        (respuesta.usage.cache_creation_input_tokens ?? 0) +
        (respuesta.usage.cache_read_input_tokens ?? 0);
      tokensSalida += respuesta.usage.output_tokens;

      if (respuesta.stop_reason === "tool_use") {
        if (rondasTools >= MAX_RONDAS_TOOLS) {
          // Se le acabaron las rondas con una tool pendiente: no se ejecuta más.
          errores.push(`tope de ${MAX_RONDAS_TOOLS} rondas de tools`);
          respuesta = null;
          break;
        }
        rondasTools++;
        const pedidas = respuesta.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
        );
        historial.push({ role: "assistant", content: respuesta.content });
        // Todas las tools de la ronda, y todos sus resultados en UN solo mensaje
        // (partirlos enseña al modelo a dejar de pedirlas en paralelo).
        const resultados: Anthropic.ToolResultBlockParam[] = [];
        for (const b of pedidas) {
          toolsLlamadas.push(b.name);
          const r = await ejecutarParaModelo(b, ctx, errores);
          if (!r.is_error) for (const n of numerosEn(String(r.content))) permitidos.add(n);
          resultados.push(r);
        }
        historial.push({ role: "user", content: resultados });
        continue;
      }

      if (respuesta.stop_reason === "refusal") break;

      // Respuesta final: control numérico. Si trae cifras sin respaldo se le
      // pide reescribir (una vez); si reincide, no se entrega.
      const texto = textoDe(respuesta);
      const faltantes = numerosSinRespaldo(texto, permitidos);
      if (faltantes.length && reintentosNumeros < MAX_REINTENTOS_NUMEROS) {
        reintentosNumeros++;
        errores.push(`reintento por números sin respaldo: ${faltantes.join(",")}`);
        historial.push({ role: "assistant", content: respuesta.content });
        historial.push({ role: "user", content: mensajeCorreccion(faltantes) });
        continue;
      }
      sinRespaldo = faltantes;
      break;
    }

    const base = { toolsLlamadas, tokensEntrada, tokensSalida };
    if (!respuesta) {
      return { ...base, respuesta: "No pude completar la consulta; intenta con una pregunta más concreta.", error: errores.join(" | ") };
    }
    if (respuesta.stop_reason === "refusal") {
      return { ...base, respuesta: "No puedo ayudar con esa petición.", error: "refusal" };
    }
    if (sinRespaldo.length) {
      errores.push(`numeros_sin_respaldo: ${sinRespaldo.join(",")}`);
      return { ...base, respuesta: RESPUESTA_SIN_CALCULAR, error: errores.join(" | ") };
    }
    const texto = textoDe(respuesta);
    if (respuesta.stop_reason === "max_tokens") errores.push("respuesta cortada por max_tokens");
    if (!texto) errores.push("el modelo no devolvió texto");
    return {
      ...base,
      respuesta: texto || "No obtuve respuesta; intenta de nuevo.",
      ...(errores.length ? { error: errores.join(" | ") } : {}),
    };
  } catch (e) {
    // Más específico primero; el detalle va a la bitácora, al usuario solo qué hacer.
    if (e instanceof Anthropic.AuthenticationError) {
      throw new ErrorCopiloto(503, "El copiloto no está configurado.", `auth: ${e.message}`);
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new ErrorCopiloto(503, "El copiloto está saturado; intenta en un momento.", `rate limit API: ${e.message}`);
    }
    if (e instanceof Anthropic.APIConnectionError) {
      throw new ErrorCopiloto(502, "No pude conectar con el copiloto; intenta de nuevo.", `conexión: ${e.message}`);
    }
    if (e instanceof Anthropic.APIError) {
      throw new ErrorCopiloto(502, "El copiloto no pudo responder; intenta de nuevo.", `API ${e.status}: ${e.message}`);
    }
    throw e;
  }
}

function textoDe(respuesta: Anthropic.Message): string {
  return respuesta.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
