import "server-only";
import { after } from "next/server";
import webpush, { WebPushError } from "web-push";
import type { Rol } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AvisoPush = {
  titulo: string;
  cuerpo: string;
  url: string; // a dónde lleva el tap
  tag?: string; // agrupa avisos de la misma renta en vez de apilarlos
  urgente?: boolean; // los operativos sí, los resúmenes no
};

export type ResultadoEnvio = { enviados: number; fallidos: number; borrados: number };

const SIN_ENVIOS: ResultadoEnvio = { enviados: 0, fallidos: 0, borrados: 0 };

let configurado = false;

/** Sin claves VAPID el push simplemente no existe (dev, o env sin configurar). */
export function pushConfigurado(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function configurar(): boolean {
  if (!pushConfigurado()) return false;
  if (!configurado) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    configurado = true;
  }
  return true;
}

/**
 * Una suscripción muerta responde 404/410 (el navegador la revocó) o 403 (las
 * claves VAPID cambiaron). Esas se borran. Un 429 o un 5xx es pasajero: ahí no
 * se borra nada o perderíamos dispositivos vivos por un hipo del push service.
 */
function suscripcionMuerta(e: unknown): boolean {
  if (!(e instanceof WebPushError)) return false;
  return e.statusCode === 404 || e.statusCode === 410 || e.statusCode === 403;
}

async function enviar(
  suscripciones: { endpoint: string; p256dh: string; auth: string }[],
  aviso: AvisoPush
): Promise<ResultadoEnvio> {
  if (!configurar() || suscripciones.length === 0) return SIN_ENVIOS;

  const payload = JSON.stringify({
    titulo: aviso.titulo,
    cuerpo: aviso.cuerpo,
    url: aviso.url,
    tag: aviso.tag,
  });

  const resultados = await Promise.allSettled(
    suscripciones.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        {
          TTL: aviso.urgente ? 60 * 60 * 6 : 60 * 60 * 12,
          urgency: aviso.urgente ? "high" : "normal",
        }
      )
    )
  );

  const vivas: string[] = [];
  const muertas: string[] = [];
  let fallidos = 0;

  resultados.forEach((r, i) => {
    const endpoint = suscripciones[i].endpoint;
    if (r.status === "fulfilled") {
      vivas.push(endpoint);
    } else if (suscripcionMuerta(r.reason)) {
      muertas.push(endpoint);
    } else {
      fallidos++;
      console.error("[push] envío fallido", endpoint, r.reason);
    }
  });

  if (muertas.length > 0) {
    await prisma.suscripcionPush.deleteMany({ where: { endpoint: { in: muertas } } });
  }
  if (vivas.length > 0) {
    await prisma.suscripcionPush.updateMany({
      where: { endpoint: { in: vivas } },
      data: { usadaEn: new Date() },
    });
  }

  return { enviados: vivas.length, fallidos, borrados: muertas.length };
}

export async function enviarAUsuarios(
  userIds: string[],
  aviso: AvisoPush
): Promise<ResultadoEnvio> {
  if (userIds.length === 0) return SIN_ENVIOS;
  const suscripciones = await prisma.suscripcionPush.findMany({
    where: { userId: { in: userIds } },
    select: { endpoint: true, p256dh: true, auth: true },
  });
  return enviar(suscripciones, aviso);
}

/** `excluirUserId`: a quien hizo la acción no se le avisa de su propia acción. */
export async function enviarARoles(
  roles: Rol[],
  aviso: AvisoPush,
  excluirUserId?: string
): Promise<ResultadoEnvio> {
  const suscripciones = await prisma.suscripcionPush.findMany({
    where: {
      usuario: { rol: { in: roles } },
      ...(excluirUserId ? { userId: { not: excluirUserId } } : {}),
    },
    select: { endpoint: true, p256dh: true, auth: true },
  });
  return enviar(suscripciones, aviso);
}

/**
 * Envía después de responder al usuario y sin propagar errores: si el push
 * service tarda o falla, la entrega igual quedó guardada y el repartidor no
 * espera. Nunca llamar dentro de un $transaction.
 */
export function avisar(tarea: () => Promise<unknown>): void {
  after(async () => {
    try {
      await tarea();
    } catch (e) {
      console.error("[push] no se pudo avisar", e);
    }
  });
}
