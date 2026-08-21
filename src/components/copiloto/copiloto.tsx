"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUp, MessageCircleMore, Sparkles, Trash2, X } from "lucide-react";
import { ocultarTabBar } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PropuestaCliente } from "@/lib/copiloto/accion";
import { TextoRespuesta } from "./texto-respuesta";
import { TarjetaPropuesta, type DecisionPropuesta } from "./tarjeta-propuesta";

// Mensaje tal cual se ve en el panel. `error`, `aviso`, `fuentes` y `propuesta`
// son locales: al API solo viajan `rol` y `texto`, y los mensajes de error o
// aviso no se reenvían (no son del asistente, son del sistema avisando algo).
type Mensaje = {
  id: string;
  rol: "usuario" | "asistente";
  texto: string;
  error?: boolean;
  aviso?: boolean; // neutro y no se reenvía (p. ej. "tienes una acción pendiente")
  fuentes?: string[]; // tools que consultó, para decir "de dónde salió"
  propuesta?: PropuestaCliente; // la acción propuesta en ese turno, con su estado
};

const CLAVE_SESION = "copiloto:conversacion";
const MAX_LOCAL = 40; // mensajes que se conservan en el panel
const MAX_ENVIADOS = 20; // los que acepta el API por turno

const ETIQUETA_TOOL: Record<string, string> = {
  resumen_operativo: "resumen del día",
  buscar_rentas: "rentas",
  buscar_unidades: "inventario",
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
 *
 * Acciones: cuando el modelo propone algo, la respuesta trae `propuesta` y se
 * pinta una tarjeta con Confirmar/Cancelar. Mientras haya una propuesta viva el
 * chat se bloquea (un "sí" escrito no es una confirmación); vence sola a los
 * 10 min. La decisión va a /api/copiloto/acciones y la tarjeta se actualiza
 * con lo que diga el servidor.
 */
export function Copiloto({
  esAdmin,
  nombre,
  acciones = false,
}: {
  esAdmin: boolean;
  nombre?: string;
  acciones?: boolean; // COPILOTO_ACCIONES_HABILITADAS (solo cambia textos)
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  // El inicializador lee sessionStorage solo en el cliente; el panel arranca
  // cerrado, así que el HTML del servidor y el primer render coinciden.
  const [mensajes, setMensajes] = useState<Mensaje[]>(cargarSesion);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [decidiendo, setDecidiendo] = useState<string | null>(null);
  const [minutosRestantes, setMinutosRestantes] = useState<number | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  // La propuesta viva (si la hay) bloquea el chat hasta que se decida.
  const pendiente = mensajes.find((m) => m.propuesta?.estado === "PROPUESTA")?.propuesta ?? null;
  const pendienteId = pendiente?.id ?? null;
  const pendienteExpira = pendiente?.expiraEn ?? null;

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

  // Cuenta regresiva de la propuesta viva; al vencer se marca EXPIRADA aquí
  // (el servidor la rechazaría igual, pero así el chat se desbloquea solo).
  useEffect(() => {
    if (!pendienteId || !pendienteExpira) return;
    const expira = new Date(pendienteExpira).getTime();
    const tick = () => {
      const faltan = Math.ceil((expira - Date.now()) / 60_000);
      if (faltan <= 0) {
        setMensajes((m) =>
          m.map((x) =>
            x.propuesta?.id === pendienteId && x.propuesta.estado === "PROPUESTA"
              ? { ...x, propuesta: { ...x.propuesta, estado: "EXPIRADA", resultado: "Venció sin confirmarse." } }
              : x,
          ),
        );
        setMinutosRestantes(null);
      } else {
        setMinutosRestantes(faltan);
      }
    };
    const primero = setTimeout(tick, 0);
    const intervalo = setInterval(tick, 15_000);
    return () => {
      clearTimeout(primero);
      clearInterval(intervalo);
    };
  }, [pendienteId, pendienteExpira]);

  if (ocultarTabBar(pathname)) return null;

  const rol = esAdmin ? "ADMIN" : "REPARTIDOR";

  async function enviar(pregunta: string) {
    const limpia = pregunta.trim();
    if (!limpia || enviando || pendiente) return;
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
            .filter((m) => !m.error && !m.aviso)
            .slice(-MAX_ENVIADOS)
            .map((m) => ({ rol: m.rol, texto: m.texto })),
        }),
      });
      const datos = (await res.json().catch(() => null)) as
        | { respuesta?: string; toolsLlamadas?: string[]; error?: string; propuesta?: PropuestaCliente }
        | null;
      if (res.ok && datos?.respuesta) {
        setMensajes((m) => [
          ...m,
          {
            id: nuevoId(),
            rol: "asistente",
            texto: datos.respuesta!,
            fuentes: datos.toolsLlamadas,
            ...(datos.propuesta ? { propuesta: datos.propuesta } : {}),
          },
        ]);
      } else if (res.status === 409 && datos?.propuesta) {
        // El servidor tiene una propuesta viva que este panel no mostraba
        // (otra pestaña, storage perdido): se repinta y se bloquea.
        setMensajes((m) => [
          ...m,
          {
            id: nuevoId(),
            rol: "asistente",
            texto: "Tienes una acción pendiente. Confírmala o cancélala para continuar.",
            aviso: true,
            propuesta: datos.propuesta,
          },
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

  // Confirmar o cancelar una propuesta. Solo viaja el id: lo que se ejecuta es
  // lo que el servidor guardó al proponer. La tarjeta se actualiza con la
  // propuesta que regrese el servidor, sea cual sea el status.
  async function decidir(propuestaId: string, decision: DecisionPropuesta, datos?: unknown) {
    if (decidiendo) return;
    setDecidiendo(propuestaId);
    try {
      const res = await fetch("/api/copiloto/acciones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: propuestaId, decision, ...(datos !== undefined ? { datos } : {}) }),
      });
      const cuerpo = (await res.json().catch(() => null)) as
        | { propuesta?: PropuestaCliente; error?: string }
        | null;
      if (cuerpo?.propuesta) {
        const p = cuerpo.propuesta;
        setMensajes((m) => m.map((x) => (x.propuesta?.id === p.id ? { ...x, propuesta: p } : x)));
        if (p.estado === "EJECUTADA") {
          toast.success(p.resultado ?? "Listo.");
          // La pantalla de fondo (dashboard, detalle) ya cambió en el servidor.
          router.refresh();
        } else if (p.estado === "FALLIDA") {
          toast.error(cuerpo.error ?? p.resultado ?? "No se pudo ejecutar.");
        } else if (cuerpo.error) {
          toast.error(cuerpo.error);
        }
      } else {
        toast.error(
          res.status === 401
            ? "Tu sesión expiró. Vuelve a iniciar sesión."
            : (cuerpo?.error ?? "No se pudo procesar. Intenta de nuevo."),
        );
        if (res.status === 404) {
          // Ya no existe o ya no está disponible para este usuario: se suelta
          // el bloqueo para no dejar el chat trabado.
          setMensajes((m) =>
            m.map((x) =>
              x.propuesta?.id === propuestaId
                ? {
                    ...x,
                    propuesta: {
                      ...x.propuesta,
                      estado: "CANCELADA",
                      resultado: cuerpo?.error ?? "Ya no está disponible.",
                    },
                  }
                : x,
            ),
          );
        }
      }
    } catch {
      toast.error("Sin conexión. Revisa tu red e intenta de nuevo.");
    } finally {
      setDecidiendo(null);
    }
  }

  async function borrar() {
    // Una propuesta viva no se deja huérfana en el servidor.
    if (pendiente) await decidir(pendiente.id, "cancelar");
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

  const bloqueado = enviando || !!pendiente;

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
          <p className="truncate text-xs text-tenue">
            {acciones ? "Consulta y propone acciones · tú confirmas" : "Solo lectura · responde con los datos del sistema"}
          </p>
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
              {esAdmin ? ", saldos o ventas" : " o recolecciones"}.{" "}
              {acciones
                ? "También puedo proponerte acciones (como poner una entrega en ruta); nada se hace hasta que tú confirmes."
                : "Solo consulto; no cambio nada."}
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGERENCIAS[rol].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviar(s)}
                  disabled={bloqueado}
                  className="rounded-full border border-linea bg-superficie-suave px-3.5 py-2 text-[13.5px] font-semibold transition hover:bg-superficie-hover active:scale-95 disabled:opacity-50"
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
                    "rounded-2xl px-3.5 py-2.5",
                    // Con tarjeta la burbuja usa todo el ancho: las líneas necesitan espacio.
                    m.propuesta ? "w-full" : "max-w-[88%]",
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
                  {m.propuesta && (
                    <TarjetaPropuesta
                      propuesta={m.propuesta}
                      minutosRestantes={m.propuesta.id === pendienteId ? minutosRestantes : null}
                      ocupado={decidiendo === m.propuesta.id}
                      onDecidir={(d, datos) => decidir(m.propuesta!.id, d, datos)}
                      onNavegar={() => setAbierto(false)}
                    />
                  )}
                  {m.fuentes && m.fuentes.some((f) => !f.startsWith("proponer_")) && (
                    <p className="mt-1.5 text-[11px] text-tenue">
                      Consultó:{" "}
                      {[
                        ...new Set(
                          m.fuentes.filter((f) => !f.startsWith("proponer_")).map((f) => ETIQUETA_TOOL[f] ?? f),
                        ),
                      ].join(", ")}
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
          placeholder={pendiente ? "Confirma o cancela la acción para continuar" : "Pregunta algo de tu negocio…"}
          rows={1}
          maxLength={2000}
          disabled={bloqueado}
          className="max-h-32 min-h-11 resize-none rounded-xl py-2.5 text-[15px] md:text-[15px]"
        />
        <Button
          type="submit"
          size="icon-lg"
          aria-label="Enviar"
          disabled={bloqueado || !texto.trim()}
          className="size-11 shrink-0 rounded-xl"
        >
          <ArrowUp className="size-5" />
        </Button>
      </form>
    </section>
  );
}
