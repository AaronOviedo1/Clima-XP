import "server-only";
import type { Rol } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DatosConsulta = {
  userId: string;
  rol: Rol;
  pregunta: string; // texto del usuario; en modo directo, el cuerpo { tool, args } tal cual
  toolsLlamadas: string[]; // solo las que de verdad corrieron
  tokensEntrada?: number;
  tokensSalida?: number;
  latenciaMs: number;
  error?: string | null; // "rate_limit", "args_invalidos", el mensaje de la excepción…
};

const MAX_PREGUNTA = 4000;
const MAX_ERROR = 500;

/**
 * Bitácora: se escribe SIEMPRE (también en error y en 429). Nunca lanza: un log
 * caído no debe tumbar la respuesta al usuario. Devuelve el id de la fila (o
 * null si no se pudo escribir) para enlazarle la propuesta de acción del turno.
 */
export async function registrarConsulta(d: DatosConsulta): Promise<string | null> {
  try {
    const fila = await prisma.consultaCopiloto.create({
      data: {
        userId: d.userId,
        rol: d.rol,
        pregunta: d.pregunta.slice(0, MAX_PREGUNTA),
        toolsLlamadas: d.toolsLlamadas,
        tokensEntrada: d.tokensEntrada ?? 0,
        tokensSalida: d.tokensSalida ?? 0,
        latenciaMs: d.latenciaMs,
        error: d.error ? d.error.slice(0, MAX_ERROR) : null,
      },
      select: { id: true },
    });
    return fila.id;
  } catch (e) {
    console.error("[copiloto] No se pudo registrar la consulta:", e);
    return null;
  }
}
