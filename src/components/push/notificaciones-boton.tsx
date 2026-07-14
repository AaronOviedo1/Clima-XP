"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, BellRing, Share } from "lucide-react";
import { toast } from "sonner";
import {
  borrarSuscripcion,
  enviarPushDePrueba,
  guardarSuscripcion,
} from "@/lib/actions/push";
import {
  desuscribirDispositivo,
  esIOS,
  esStandalone,
  soportaPush,
  suscribirDispositivo,
  suscripcionActual,
} from "@/lib/push-cliente";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Estado = "cargando" | "sin-soporte" | "instalar" | "puede" | "bloqueado" | "activo";

export function NotificacionesBoton({
  clavePublica,
  // El dashboard la esconde una vez activada (ya cumplió); en /configuracion se
  // queda para poder desactivar o mandar una prueba.
  mostrarSiempre = false,
}: {
  clavePublica: string | null;
  mostrarSiempre?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [trabajando, empezar] = useTransition();

  useEffect(() => {
    (async () => {
      if (!clavePublica || !soportaPush()) {
        // En iPhone sin instalar, Notification/PushManager ni siquiera existen:
        // el aviso de "instálala" importa más que decir "no compatible".
        setEstado(esIOS() && !esStandalone() ? "instalar" : "sin-soporte");
        return;
      }
      if (esIOS() && !esStandalone()) return setEstado("instalar");
      if (Notification.permission === "denied") return setEstado("bloqueado");
      if (Notification.permission === "granted") {
        setEstado((await suscripcionActual()) ? "activo" : "puede");
        return;
      }
      setEstado("puede");
    })();
  }, [clavePublica]);

  function activar() {
    empezar(async () => {
      // requestPermission() va PRIMERO: Safari descarta el prompt si el gesto
      // del usuario ya se gastó en otro await.
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "puede");
        return;
      }

      try {
        const sub = await suscribirDispositivo(clavePublica!);
        const res = await guardarSuscripcion(sub);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        setEstado("activo");
        toast.success("Notificaciones activadas en este dispositivo.");
      } catch (e) {
        console.error(e);
        toast.error("No se pudo activar. Intenta de nuevo.");
      }
    });
  }

  function desactivar() {
    empezar(async () => {
      const endpoint = await desuscribirDispositivo();
      if (endpoint) await borrarSuscripcion(endpoint);
      setEstado("puede");
      toast.success("Notificaciones desactivadas en este dispositivo.");
    });
  }

  function probar() {
    empezar(async () => {
      const res = await enviarPushDePrueba();
      if ("error" in res) toast.error(res.error);
      else toast.success("Aviso de prueba enviado.");
    });
  }

  if (estado === "cargando") return null;
  if (estado === "sin-soporte") {
    return mostrarSiempre ? (
      <Texto>Este navegador no admite notificaciones.</Texto>
    ) : null;
  }
  if (estado === "activo" && !mostrarSiempre) return null;

  if (estado === "instalar") {
    return (
      <Marco>
        <Share className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Instala la app para recibir avisos</p>
          <p className="text-sm text-muted-foreground">
            En Safari toca Compartir y luego “Agregar a pantalla de inicio”. Abre
            Climaxpress desde ese ícono y activa las notificaciones ahí.
          </p>
        </div>
      </Marco>
    );
  }

  if (estado === "bloqueado") {
    return (
      <Marco>
        <BellOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Notificaciones bloqueadas</p>
          <p className="text-sm text-muted-foreground">
            El permiso está denegado en este dispositivo. Actívalo en los ajustes
            del sistema: Notificaciones → Climaxpress.
          </p>
        </div>
      </Marco>
    );
  }

  if (estado === "activo") {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-500">
          <BellRing className="size-4" /> Activadas en este dispositivo.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1" onClick={probar} disabled={trabajando}>
            Enviar prueba
          </Button>
          <Button
            variant="ghost"
            className="h-11 flex-1"
            onClick={desactivar}
            disabled={trabajando}
          >
            Desactivar
          </Button>
        </div>
      </div>
    );
  }

  // estado === "puede"
  const boton = (
    <Button className="h-11 w-full text-base" onClick={activar} disabled={trabajando}>
      <Bell className="size-5" />
      {trabajando ? "Activando…" : "Activar notificaciones"}
    </Button>
  );

  if (mostrarSiempre) {
    return (
      <div className="space-y-2">
        {boton}
        <p className="text-sm text-muted-foreground">
          Avisos de entregas del día, rentas confirmadas y saldos por cobrar. Hay
          que activarlas en cada dispositivo.
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <p className="text-sm text-muted-foreground">
          Activa los avisos para enterarte de las entregas del día sin abrir la app.
        </p>
        {boton}
      </CardContent>
    </Card>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-4">{children}</CardContent>
    </Card>
  );
}

function Texto({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
