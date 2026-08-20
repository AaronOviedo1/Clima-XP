"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, MessageCircleMore, Sparkles, Trash2, X } from "lucide-react";
import { ocultarTabBar } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TextoRespuesta } from "./texto-respuesta";

// Mensaje tal cual se ve en el panel. `error` y `fuentes` son locales: al API
// solo viajan `rol` y `texto`, y los mensajes de error no se reenvían (no son
// del asistente, son del sistema avisando que algo falló).
type Mensaje = {
  id: string;
  rol: "usuario" | "asistente";
  texto: string;
  error?: boolean;
  fuentes?: string[]; // tools que consultó, para decir "de dónde salió"
};

const CLAVE_SESION = "copiloto:conversacion";
const MAX_LOCAL = 40; // mensajes que se conservan en el panel
const MAX_ENVIADOS = 20; // los que acepta el API por turno

const ETIQUETA_TOOL: Record<string, string> = {
  resumen_operativo: "resumen del día",
  disponibilidad_equipos: "disponibilidad",
  ingresos_periodo: "ingresos",
  saldos_pendientes: "saldos",
  historial_cliente: "clientes",
};

const SUGERENCIAS: Record<"ADMIN" | "REPARTIDOR", string[]> = {
  ADMIN: [
    "¿Qué tengo hoy?",
    "¿Quién me debe?",
    "¿Cuánto vendí este mes?",
    "¿Hay equipo libre el fin de semana?",
  ],
  REPARTIDOR: ["¿Qué entregas hay hoy?", "¿Qué recolecciones faltan?", "¿Hay equipo libre mañana?"],
};

function cargarSesion(): Mensaje[] {
  if (typeof window === "undefined") return [];
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_SESION);
    const lista = crudo ? (JSON.parse(crudo) as Mensaje[]) : [];
    return Array.isArray(lista) ? lista.slice(-MAX_LOCAL) : [];
  } catch {
    return [];
  }
}

function nuevoId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Widget del copiloto: botón flotante + panel de chat. Vive en el layout del
 * shell autenticado (solo si el flag está prendido), así conserva la
 * conversación al navegar entre pantallas; además la guarda en sessionStorage
 * para sobrevivir una recarga. Móvil: pantalla completa. Escritorio: panel
 * flotante abajo a la derecha. Se esconde en el alta/edición de renta, como el
 * tab bar: ahí estorba.
 */
export function Copiloto({ esAdmin, nombre }: { esAdmin: boolean; nombre?: string }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  // El inicializador lee sessionStorage solo en el cliente; el panel arranca
  // cerrado, así que el HTML del servidor y el primer render coinciden.
  const [mensajes, setMensajes] = useState<Mensaje[]>(cargarSesion);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(CLAVE_SESION, JSON.stringify(mensajes.slice(-MAX_LOCAL)));
    } catch {
      // sin sessionStorage (modo privado agresivo): la conversación vive solo en memoria
    }
  }, [mensajes]);

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ block: "end" });
  }, [abierto, mensajes, enviando]);

  if (ocultarTabBar(pathname)) return null;

  const rol = esAdmin ? "ADMIN" : "REPARTIDOR";

  async function enviar(pregunta: string) {
    const limpia = pregunta.trim();
    if (!limpia || enviando) return;
    const mio: Mensaje = { id: nuevoId(), rol: "usuario", texto: limpia };
    const historial = [...mensajes, mio];
    setMensajes(historial);
    setTexto("");
    setEnviando(true);
    try {
      const res = await fetch("/api/copiloto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mensajes: historial
            .filter((m) => !m.error)
            .slice(-MAX_ENVIADOS)
            .map((m) => ({ rol: m.rol, texto: m.texto })),
        }),
      });
      const datos = (await res.json().catch(() => null)) as
        | { respuesta?: string; toolsLlamadas?: string[]; error?: string }
        | null;
      if (res.ok && datos?.respuesta) {
        setMensajes((m) => [
          ...m,
          { id: nuevoId(), rol: "asistente", texto: datos.respuesta!, fuentes: datos.toolsLlamadas },
        ]);
      } else {
        const aviso =
          res.status === 429
            ? "Demasiadas consultas seguidas; espera un momento e intenta de nuevo."
            : res.status === 401
              ? "Tu sesión expiró. Vuelve a iniciar sesión."
              : (datos?.error ?? "No pude responder. Intenta de nuevo.");
        setMensajes((m) => [...m, { id: nuevoId(), rol: "asistente", texto: aviso, error: true }]);
      }
    } catch {
      setMensajes((m) => [
        ...m,
        { id: nuevoId(), rol: "asistente", texto: "Sin conexión. Revisa tu red e intenta de nuevo.", error: true },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  function borrar() {
    setMensajes([]);
    setTexto("");
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir copiloto"
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+78px)] z-40 flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_-8px_var(--primary)] transition-transform active:scale-90 lg:right-6 lg:bottom-6"
      >
        <MessageCircleMore className="size-6" strokeWidth={2.1} aria-hidden />
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label="Copiloto"
      onKeyDown={(e) => {
        if (e.key === "Escape") setAbierto(false);
      }}
      className={cn(
        "fixed z-50 flex flex-col bg-card text-card-foreground",
        // Móvil: toda la pantalla, respetando las muescas.
        "inset-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        // Escritorio: panel flotante.
        "lg:inset-auto lg:right-6 lg:bottom-6 lg:h-[min(640px,calc(100dvh-3rem))] lg:w-[400px] lg:rounded-2xl lg:border lg:border-linea lg:p-0 lg:shadow-[0_24px_60px_-20px_rgba(0,0,0,.35)]",
      )}
    >
      {/* Encabezado */}
      <header className="flex items-center gap-3 border-b border-linea px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-chip-azul text-chip-azul-fg">
          <Sparkles className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] leading-tight font-extrabold">Copiloto</h2>
          <p className="truncate text-xs text-tenue">Solo lectura · responde con los datos del sistema</p>
        </div>
        {mensajes.length > 0 && (
          <Button variant="ghost" size="icon" onClick={borrar} aria-label="Borrar conversación" title="Borrar conversación">
            <Trash2 className="size-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => setAbierto(false)} aria-label="Cerrar copiloto">
          <X className="size-5" />
        </Button>
      </header>

      {/* Conversación */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {mensajes.length === 0 ? (
          <div className="space-y-4">
            <p className="text-[15px] leading-snug">
              Hola{nombre ? `, ${nombre.split(" ")[0]}` : ""}. Pregúntame por tus entregas, equipos libres
              {esAdmin ? ", saldos o ventas" : " o recolecciones"}. Solo consulto; no cambio nada.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGERENCIAS[rol].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviar(s)}
                  className="rounded-full border border-linea bg-superficie-suave px-3.5 py-2 text-[13.5px] font-semibold transition hover:bg-superficie-hover active:scale-95"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {mensajes.map((m) => (
              <li key={m.id} className={cn("flex", m.rol === "usuario" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-3.5 py-2.5",
                    m.rol === "usuario"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : m.error
                        ? "rounded-bl-md border border-destructive/40 bg-destructive/5 text-destructive"
                        : "rounded-bl-md bg-superficie-suave",
                  )}
                >
                  {m.rol === "usuario" ? (
                    <p className="text-[14.5px] leading-snug whitespace-pre-wrap">{m.texto}</p>
                  ) : (
                    <TextoRespuesta texto={m.texto} />
                  )}
                  {m.fuentes && m.fuentes.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-tenue">
                      Consultó: {[...new Set(m.fuentes.map((f) => ETIQUETA_TOOL[f] ?? f))].join(", ")}
                    </p>
                  )}
                </div>
              </li>
            ))}
            {enviando && (
              <li className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-superficie-suave px-3.5 py-2.5 text-sm text-tenue">
                  <span className="animate-pulse">Consultando…</span>
                </div>
              </li>
            )}
          </ul>
        )}
        <div ref={finRef} />
      </div>

      {/* Entrada */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        className="flex items-end gap-2 border-t border-linea px-3 py-3"
      >
        <Textarea
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter manda; Shift+Enter hace salto de línea.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar(texto);
            }
          }}
          placeholder="Pregunta algo de tu negocio…"
          rows={1}
          maxLength={2000}
          disabled={enviando}
          className="max-h-32 min-h-11 resize-none rounded-xl py-2.5 text-[15px] md:text-[15px]"
        />
        <Button
          type="submit"
          size="icon-lg"
          aria-label="Enviar"
          disabled={enviando || !texto.trim()}
          className="size-11 shrink-0 rounded-xl"
        >
          <ArrowUp className="size-5" />
        </Button>
      </form>
    </section>
  );
}
