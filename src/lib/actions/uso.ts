"use server";

import { auth } from "@/auth";
import { AUTH_HABILITADA } from "@/lib/auth-flag";
import { PANTALLA_RE } from "@/lib/pantallas";
import { prisma } from "@/lib/prisma";

// Volver a la misma pantalla dentro de este lapso no cuenta otra vez: un
// cambio de pestaña de ida y vuelta no es «usarla» dos veces.
const DEDUPE_MS = 60_000;

/**
 * Registra que la sesión abrió una pantalla. Solo alimenta `metricas_uso`
 * (pasta-stats). Nunca falla hacia el usuario: medir no puede romper la app.
 * Con el login apagado el usuario es ficticio ("sin-login") y no hay a quién
 * atribuirla, así que no se registra.
 */
export async function logScreenViewAction(pantalla: string): Promise<void> {
  try {
    if (!AUTH_HABILITADA || !PANTALLA_RE.test(pantalla)) return;
    const userId = (await auth())?.user?.id;
    if (!userId) return;

    const reciente = await prisma.screenView.findFirst({
      where: {
        userId,
        pantalla,
        createdAt: { gte: new Date(Date.now() - DEDUPE_MS) },
      },
      select: { id: true },
    });
    if (reciente) return;

    await prisma.screenView.create({ data: { userId, pantalla } });
  } catch (error) {
    console.error("[uso] no se pudo registrar la vista", error);
  }
}
