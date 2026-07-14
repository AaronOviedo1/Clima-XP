"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { AUTH_HABILITADA } from "@/lib/auth-flag";
import { esAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { enviarAUsuarios, pushConfigurado } from "@/lib/push";

export type PushActionResult = { ok: true } | { error: string };

const suscripcionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(300).optional(),
});

export type SuscripcionInput = z.input<typeof suscripcionSchema>;

/**
 * Las suscripciones cuelgan de un User real. Con el login apagado el usuario es
 * ficticio ("sin-login") y no existe en la tabla, así que no hay a quién avisar.
 */
async function usuarioActual(): Promise<{ id: string } | null> {
  if (!AUTH_HABILITADA) return null;
  const session = await auth();
  return session?.user?.id ? { id: session.user.id } : null;
}

/** Idempotente por endpoint: re-suscribir el mismo dispositivo no duplica filas. */
export async function guardarSuscripcion(
  input: SuscripcionInput
): Promise<PushActionResult> {
  const usuario = await usuarioActual();
  if (!usuario) return { error: "Inicia sesión para activar los avisos." };

  const parsed = suscripcionSchema.safeParse(input);
  if (!parsed.success) return { error: "La suscripción del navegador no es válida." };
  const { endpoint, keys, userAgent } = parsed.data;

  try {
    await prisma.suscripcionPush.upsert({
      where: { endpoint },
      // Si el dispositivo cambió de usuario, la fila se reapunta al nuevo.
      update: { userId: usuario.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
      create: { userId: usuario.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    });
  } catch (e) {
    console.error("[push] no se pudo guardar la suscripción", e);
    return { error: "No se pudo guardar la suscripción." };
  }

  return { ok: true };
}

export async function borrarSuscripcion(endpoint: string): Promise<PushActionResult> {
  const usuario = await usuarioActual();
  if (!usuario) return { error: "Inicia sesión." };

  await prisma.suscripcionPush.deleteMany({ where: { endpoint, userId: usuario.id } });
  return { ok: true };
}

/** Prueba de humo: manda un push a los dispositivos del propio admin. */
export async function enviarPushDePrueba(): Promise<PushActionResult> {
  if (!(await esAdmin())) return { error: "Solo el administrador puede enviar pruebas." };
  if (!pushConfigurado()) return { error: "Faltan las claves VAPID en el servidor." };

  const usuario = await usuarioActual();
  if (!usuario) return { error: "Inicia sesión." };

  const r = await enviarAUsuarios([usuario.id], {
    titulo: "Prueba de Climaxpress ✅",
    cuerpo: "Si ves esto, las notificaciones funcionan en este dispositivo.",
    url: "/",
    tag: "prueba",
    urgente: true,
  });

  if (r.enviados === 0) {
    return {
      error:
        r.borrados > 0
          ? "La suscripción de este dispositivo ya no era válida. Actívalas de nuevo."
          : "No hay ningún dispositivo con notificaciones activadas para tu usuario.",
    };
  }
  return { ok: true };
}
