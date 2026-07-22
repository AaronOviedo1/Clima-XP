"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";

/*
 * Deja que una pantalla publique cosas suyas en el TopBar de escritorio: su
 * subtítulo (Inventario: "28 unidades · 4 modelos") y sus acciones (Clientes:
 * "Nuevo cliente"; Reportes: el selector de años), que se calculan con datos
 * que el layout no tiene. Cada dato usa dos contextos y no uno: el setter de
 * useState es estable, así que el efecto del publicador no se vuelve a
 * disparar cuando el valor cambia — con un objeto {valor, set} el efecto se
 * reejecutaría en cada render del provider y entraría en bucle.
 *
 * Cada publicación lleva la ruta que la publicó, capturada al montar. Sin
 * eso, un pop-up interceptado ("Nueva renta" desde Clientes) delataba el
 * truco: la página de fondo sigue montada — su cleanup no corre — pero el
 * pathname ya es /rentas/nueva, y el TopBar mostraba el título "Rentas" con
 * los botones de Clientes debajo (el overlay del Dialog es casi
 * transparente). El TopBar solo pinta lo publicado si la ruta coincide.
 */
type Publicacion<T> = { ruta: string; valor: T } | null;

const SubtituloCtx = createContext<Publicacion<string>>(null);
const SetSubtituloCtx = createContext<(p: Publicacion<string>) => void>(() => {});
const AccionesCtx = createContext<Publicacion<React.ReactNode>>(null);
const SetAccionesCtx = createContext<(p: Publicacion<React.ReactNode>) => void>(
  () => {},
);

// Publicar antes de pintar (sin el frame de TopBar sin botones que deja
// useEffect); en SSR no existe useLayoutEffect, así que ahí cae a useEffect.
const useLayoutEffectIso =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

// Estilo compartido de las acciones tipo botón que suben al TopBar (mismo
// alto y radio que el buscador y "Nueva renta", mismo look que la campana).
// Los gemelos dark: no sobran: cuando esta clase viste a un <Button
// variant="outline">, tailwind-merge no elimina los dark:bg-input/30 y
// dark:hover:bg-input/50 del variant (otra cadena de modificadores) y esos
// le ganarían a bg-card por especificidad; con el mismo modificador, sí.
export const CLASE_ACCION_TOP_BAR =
  "flex h-10 items-center gap-1.5 rounded-xl border border-input bg-card px-4 text-sm font-bold whitespace-nowrap text-foreground transition-colors hover:border-primary/40 hover:bg-superficie-suave dark:bg-card dark:hover:bg-superficie-suave";

export function SeccionProvider({ children }: { children: React.ReactNode }) {
  const [subtitulo, setSubtitulo] = useState<Publicacion<string>>(null);
  const [acciones, setAcciones] = useState<Publicacion<React.ReactNode>>(null);
  return (
    <SetSubtituloCtx.Provider value={setSubtitulo}>
      <SetAccionesCtx.Provider value={setAcciones}>
        <SubtituloCtx.Provider value={subtitulo}>
          <AccionesCtx.Provider value={acciones}>{children}</AccionesCtx.Provider>
        </SubtituloCtx.Provider>
      </SetAccionesCtx.Provider>
    </SetSubtituloCtx.Provider>
  );
}

// Los lee el TopBar, que compara `ruta` con el pathname actual; null o ruta
// distinta = usa el subtítulo fijo de la ruta / sin acciones.
export function useSubtituloSeccion() {
  return useContext(SubtituloCtx);
}

export function useAccionesSeccion() {
  return useContext(AccionesCtx);
}

// La ruta dueña se congela al montar: usePathname() en vivo no sirve, porque
// al abrir el pop-up interceptado el publicador de fondo re-renderiza con el
// pathname nuevo y volvería a publicar como si fuera suyo.
function useRutaPropia() {
  const pathname = usePathname();
  const [ruta] = useState(pathname);
  return ruta;
}

// Los renderiza la página (aunque sea server component) para publicar su
// subtítulo; al salir de la pantalla se limpia solo.
export function SubtituloSeccion({ texto }: { texto: string }) {
  const setSubtitulo = useContext(SetSubtituloCtx);
  const ruta = useRutaPropia();
  useLayoutEffectIso(() => {
    setSubtitulo({ ruta, valor: texto });
    return () => setSubtitulo(null);
  }, [setSubtitulo, ruta, texto]);
  return null;
}

// Igual que el subtítulo, pero con los botones de la pantalla (solo se ven en
// `lg+`: en móvil el TopBar no existe y cada vista conserva los suyos).
export function AccionesSeccion({ children }: { children: React.ReactNode }) {
  const setAcciones = useContext(SetAccionesCtx);
  const ruta = useRutaPropia();
  useLayoutEffectIso(() => {
    setAcciones({ ruta, valor: children });
    return () => setAcciones(null);
  }, [setAcciones, ruta, children]);
  return null;
}
