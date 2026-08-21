import { z } from "zod";
import { contextoDesdeSesion } from "@/lib/copiloto/contexto";
import { accionesParaRol, buscarAccion, buscarTool, toolsParaRol } from "@/lib/copiloto/registro";
import { ArgsInvalidos } from "@/lib/copiloto/tool";
import { AccionNoPermitida } from "@/lib/copiloto/accion";
import { registrarConsulta } from "@/lib/copiloto/log";
import { ERROR_RATE_LIMIT, verificarLimite } from "@/lib/copiloto/rate-limit";
import { ErrorCopiloto, mensajesSchema, responderPregunta } from "@/lib/copiloto/runner";
import { accionesHabilitadas, copilotoHabilitado } from "@/lib/copiloto/flag";
import { prepararPropuesta, propuestaPendiente, vincularConsulta } from "@/lib/copiloto/propuestas";

// Copiloto de chat. Dos modos, mismo orden siempre:
// sesión → rate limit → cuerpo → tool(s) → bitácora.
//   · Conversación: { mensajes: [{ rol, texto }…] } → el modelo elige tools y
//     redacta (runner.ts). Es lo que usa el widget. Si el modelo propuso una
//     acción, la respuesta trae `propuesta` y la persona la decide en
//     /api/copiloto/acciones; mientras haya una viva, aquí se contesta 409.
//   · Directo: { tool, args } ejecuta una tool de lectura y devuelve su JSON
//     tal cual lo recibiría el modelo; con una acción, solo crea la propuesta
//     (nada se ejecuta). Sirve para probar con curl; mismo permiso que el modo
//     conversación (sesión + rol), así que no abre nada nuevo.
//
// La ruta queda detrás del proxy (sin cookie redirige al login); el 401 de aquí
// es la segunda capa, y la única que aplica si AUTH_HABILITADA se pone en false.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cuerpoDirecto = z.object({
  tool: z.string().min(1).max(60),
  args: z.unknown().optional(),
});
const cuerpoConversacion = z.object({ mensajes: mensajesSchema });
const cuerpoSchema = z.union([cuerpoConversacion, cuerpoDirecto]);

// GET: qué tools tiene este usuario y qué args aceptan (JSON Schema, el mismo
// que se le dará al modelo). No va a la bitácora: es metadata, no una consulta.
// Con el flag apagado el endpoint no existe (404), igual que el botón.
const APAGADO = () => Response.json({ error: "Copiloto deshabilitado." }, { status: 404 });

export async function GET() {
  if (!copilotoHabilitado()) return APAGADO();
  const ctx = await contextoDesdeSesion();
  if (!ctx) return Response.json({ error: "No autorizado" }, { status: 401 });
  return Response.json({
    hoy: ctx.hoy,
    rol: ctx.rol,
    tools: [
      ...toolsParaRol(ctx.rol).map((t) => ({
        nombre: t.nombre,
        tipo: "consulta",
        descripcion: t.descripcion,
        args: z.toJSONSchema(t.args),
      })),
      ...accionesParaRol(ctx.rol).map((a) => ({
        nombre: a.nombre,
        tipo: "accion",
        descripcion: a.descripcion,
        args: z.toJSONSchema(a.args),
      })),
    ],
  });
}

export async function POST(req: Request) {
  if (!copilotoHabilitado()) return APAGADO();
  const inicio = Date.now();

  const ctx = await contextoDesdeSesion();
  if (!ctx) return Response.json({ error: "No autorizado" }, { status: 401 });

  // En conversación la "pregunta" de la bitácora es el último mensaje del
  // usuario; en modo directo (y cuando el cuerpo no es válido) el cuerpo crudo.
  const textoCuerpo = await req.text();
  let pregunta = textoCuerpo;
  const responder = async (
    status: number,
    cuerpo: unknown,
    toolsLlamadas: string[],
    error?: string,
    headers?: HeadersInit,
    tokens?: { entrada: number; salida: number },
    propuestaId?: string,
  ) => {
    const consultaId = await registrarConsulta({
      userId: ctx.userId,
      rol: ctx.rol,
      pregunta,
      toolsLlamadas,
      tokensEntrada: tokens?.entrada,
      tokensSalida: tokens?.salida,
      latenciaMs: Date.now() - inicio,
      error,
    });
    // La propuesta del turno queda enlazada a la consulta que la generó.
    if (propuestaId && consultaId) await vincularConsulta(propuestaId, consultaId);
    return Response.json(cuerpo, { status, headers });
  };

  // Todo lo que sigue va dentro de un try: cualquier excepción, venga de donde
  // venga (una tool, la validación, el propio rate limit), termina en la
  // bitácora con su mensaje. Sin esto, un throw fuera del try de la tool hacía
  // que Next contestara 500 sin dejar fila.
  let toolEnCurso: string | null = null;
  try {
    // Rate limit antes de hacer nada caro (y antes del modelo, en el paso 3).
    const limite = await verificarLimite(ctx.userId);
    if (!limite.ok) {
      return await responder(
        429,
        { error: "Demasiadas consultas; espera un momento." },
        [],
        ERROR_RATE_LIMIT,
        { "Retry-After": String(limite.reintentarEnSeg) },
      );
    }

    let json: unknown = null;
    try {
      json = JSON.parse(textoCuerpo);
    } catch {
      // No es JSON: cae en el 400 de abajo.
    }
    const cuerpo = cuerpoSchema.safeParse(json);
    if (!cuerpo.success) {
      return await responder(
        400,
        { error: "Cuerpo inválido: se espera { mensajes } o { tool, args }." },
        [],
        "cuerpo_invalido",
      );
    }

    // --- Modo conversación ---
    if ("mensajes" in cuerpo.data) {
      const mensajes = cuerpo.data.mensajes;
      pregunta = mensajes.at(-1)!.texto;
      // Con una propuesta viva no se consulta al modelo: primero se decide.
      // Cubre también el widget que perdió la tarjeta (otra pestaña, storage).
      if (accionesHabilitadas()) {
        const pendiente = await propuestaPendiente(ctx.userId);
        if (pendiente) {
          return await responder(
            409,
            { error: "Tienes una acción pendiente de confirmar o cancelar.", propuesta: pendiente },
            [],
            "propuesta_pendiente",
          );
        }
      }
      try {
        const r = await responderPregunta(ctx, mensajes);
        return await responder(
          200,
          {
            respuesta: r.respuesta,
            toolsLlamadas: r.toolsLlamadas,
            hoy: ctx.hoy,
            ...(r.propuesta ? { propuesta: r.propuesta } : {}),
          },
          r.toolsLlamadas,
          r.error,
          undefined,
          { entrada: r.tokensEntrada, salida: r.tokensSalida },
          r.propuesta?.id,
        );
      } catch (e) {
        if (e instanceof ErrorCopiloto) {
          console.error(`[copiloto] ${e.detalle}`);
          return await responder(e.status, { error: e.message }, [], e.detalle);
        }
        throw e;
      }
    }

    // --- Modo directo ---
    // Una acción solo se propone (fila PROPUESTA); se decide en /acciones.
    const accion = buscarAccion(cuerpo.data.tool, ctx.rol);
    if (accion) {
      const args = accion.args.safeParse(cuerpo.data.args ?? {});
      if (!args.success) {
        return await responder(
          400,
          { error: args.error.issues[0]?.message ?? "Argumentos inválidos." },
          [],
          "args_invalidos",
        );
      }
      toolEnCurso = accion.nombre;
      const propuesta = await prepararPropuesta(accion, args.data, ctx);
      return await responder(
        200,
        { tool: accion.nombre, hoy: ctx.hoy, propuesta },
        [accion.nombre],
        undefined,
        undefined,
        undefined,
        propuesta.id,
      );
    }

    // Filtrada por rol: una tool de admin "no existe" para el repartidor.
    const tool = buscarTool(cuerpo.data.tool, ctx.rol);
    if (!tool) {
      return await responder(
        404,
        {
          error: `Tool no disponible: ${cuerpo.data.tool}`,
          disponibles: [
            ...toolsParaRol(ctx.rol).map((t) => t.nombre),
            ...accionesParaRol(ctx.rol).map((a) => a.nombre),
          ],
        },
        [],
        "tool_no_disponible",
      );
    }

    const args = tool.args.safeParse(cuerpo.data.args ?? {});
    if (!args.success) {
      return await responder(
        400,
        { error: args.error.issues[0]?.message ?? "Argumentos inválidos." },
        [],
        "args_invalidos",
      );
    }

    toolEnCurso = tool.nombre;
    const resultado = await tool.ejecutar(args.data, ctx);
    return await responder(200, { tool: tool.nombre, hoy: ctx.hoy, resultado }, [tool.nombre]);
  } catch (e) {
    // La tool rechazó los args con el contexto en la mano: es un 400, no un fallo.
    if (e instanceof ArgsInvalidos) {
      return responder(400, { error: e.message }, [], "args_invalidos");
    }
    if (e instanceof AccionNoPermitida) {
      return responder(403, { error: e.message }, [], "accion_no_permitida");
    }
    const mensaje = e instanceof Error ? e.message : "error desconocido";
    console.error(`[copiloto] falló${toolEnCurso ? ` (${toolEnCurso})` : ""}:`, e);
    return responder(
      500,
      { error: "No se pudo ejecutar la consulta." },
      toolEnCurso ? [toolEnCurso] : [],
      mensaje,
    );
  }
}
