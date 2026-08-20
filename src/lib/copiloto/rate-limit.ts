import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Límite por usuario en ventanas deslizantes, contadas sobre la propia bitácora
 * (ConsultaCopiloto): una query por ventana y vale igual en todas las instancias
 * — un Map en memoria se reparte por instancia en Vercel y cada una llevaría su
 * cuenta. Los 429 se registran pero no cuentan: si contaran, cada intento
 * rechazado alargaría el castigo.
 */
export const VENTANAS_LIMITE = [
  { ms: 60_000, maximo: 20 }, // ráfaga
  { ms: 24 * 60 * 60_000, maximo: 300 }, // tope diario (acota el gasto cuando entre el modelo)
] as const;

export const ERROR_RATE_LIMIT = "rate_limit";

export type ResultadoLimite = { ok: true } | { ok: false; reintentarEnSeg: number };

export async function verificarLimite(
  userId: string,
  ahora = new Date(),
): Promise<ResultadoLimite> {
  const conteos = await Promise.all(
    VENTANAS_LIMITE.map((v) =>
      prisma.consultaCopiloto.count({
        where: {
          userId,
          createdAt: { gte: new Date(ahora.getTime() - v.ms) },
          // `{ error: { not: X } }` es `error <> X` en SQL, que con error NULL da
          // NULL y descarta la fila: las consultas buenas (error = null) no
          // contarían. De ahí el OR explícito.
          OR: [{ error: null }, { error: { not: ERROR_RATE_LIMIT } }],
        },
      }),
    ),
  );
  for (let i = 0; i < VENTANAS_LIMITE.length; i++) {
    if (conteos[i] >= VENTANAS_LIMITE[i].maximo) {
      return { ok: false, reintentarEnSeg: Math.ceil(VENTANAS_LIMITE[i].ms / 1000) };
    }
  }
  return { ok: true };
}
