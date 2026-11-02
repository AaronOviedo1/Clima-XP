/**
 * Nombre de pantalla para medir el uso en el panel pasta-stats. Lo que se
 * guarda en `ScreenView.pantalla` y termina como slug de métrica en
 * `metricas_uso` (`v_<pantalla>_<usuario>`), así que: minúsculas, `/` y `-`,
 * nunca un id, y corto (`v_` + 32 + `_<usuario>` caben en los 40 del
 * contrato).
 *
 * Puro y sin `server-only`: lo usan el tracker del cliente y la server action.
 */

export const PANTALLA_RE = /^[a-z0-9/-]{1,32}$/;

/** Evento con el que una vista avisa de una sub-pantalla (un paso, una pestaña). */
export const PANTALLA_EVENT = "clima:pantalla";

// cuid (Prisma) o número: cualquier segmento así es un registro.
const ID_RE = /^(c[a-z0-9]{20,}|\d+)$/i;

/** Pantalla de una ruta, o `null` si no cabe en el contrato. */
export function pantallaDeRuta(pathname: string): string | null {
  const segmentos = pathname.split("/").filter(Boolean);
  if (segmentos.length === 0) return "inicio";
  const nombre = segmentos.map((s) => (ID_RE.test(s) ? "detalle" : s.toLowerCase())).join("/");
  return PANTALLA_RE.test(nombre) ? nombre : null;
}

/** Avisa al tracker que se abrió una sub-pantalla. No hace nada en el servidor. */
export function marcarPantalla(pantalla: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PANTALLA_EVENT, { detail: pantalla }));
}
