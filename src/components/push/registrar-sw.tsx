"use client";

import { useEffect } from "react";
import { guardarSuscripcion } from "@/lib/actions/push";
import { registrarSW, soportaPush, suscripcionActual } from "@/lib/push-cliente";

/**
 * Registra el service worker y re-sincroniza la suscripción de este dispositivo
 * en cada carga. Es lo que cubre dos casos que no tienen otro hilo: el navegador
 * rotó el endpoint, o alguien más inició sesión en el mismo teléfono (la fila se
 * reapunta a su usuario). El upsert por endpoint lo hace idempotente.
 */
export function RegistrarSW() {
  useEffect(() => {
    if (!soportaPush()) return;

    (async () => {
      try {
        await registrarSW();
        if (Notification.permission !== "granted") return;
        const sub = await suscripcionActual();
        if (sub) await guardarSuscripcion(sub);
      } catch (e) {
        console.error("[push] no se pudo registrar el service worker", e);
      }
    })();
  }, []);

  return null;
}
