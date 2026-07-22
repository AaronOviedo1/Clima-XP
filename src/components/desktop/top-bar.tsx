"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Bell, Plus, Search } from "lucide-react";

// Título y subtítulo por sección (el diseño los muestra en el header claro).
const META: Record<string, [string, string]> = {
  "/": ["Hoy", ""],
  "/ruta": ["Ruta del día", "Entregas ordenadas por cercanía"],
  "/rentas": ["Rentas", "Agrupadas por semana de entrega"],
  "/clientes": ["Clientes", "Directorio de clientes"],
  "/inventario": ["Inventario", "Unidades y modelos"],
  "/calendario": ["Calendario", "Entregas y recolecciones por día"],
  "/reportes": ["Reportes", "Ingresos, utilización y comparativos"],
  "/configuracion": ["Configuración", "Precios, tarifas, bodega y notificaciones"],
};

function metaDeRuta(pathname: string): [string, string] {
  if (pathname === "/") return META["/"];
  const clave = Object.keys(META)
    .filter((k) => k !== "/" && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return clave ? META[clave] : ["Climaxpress", ""];
}

/**
 * Header claro del shell de escritorio: título por ruta, buscador global,
 * botón "Nueva renta" y campana. Solo visible en `lg+`.
 */
export function TopBar({
  esAdmin,
  fechaHoy,
}: {
  esAdmin: boolean;
  fechaHoy: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [titulo, subtituloBase] = metaDeRuta(pathname);
  const subtitulo = pathname === "/" ? fechaHoy : subtituloBase;

  // El buscador filtra la sección actual si soporta ?q= (Clientes o Rentas);
  // desde cualquier otra pantalla busca rentas por defecto.
  const base = pathname.startsWith("/clientes") ? "/clientes" : "/rentas";
  const yaEnBase = pathname.startsWith(base);

  const [texto, setTexto] = useState(searchParams.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Al cambiar de sección reflejamos el ?q= de la nueva ruta en el input, sin un
  // effect (patrón de "ajustar estado en render" recomendado por React).
  const [seccionPrevia, setSeccionPrevia] = useState(pathname);
  if (pathname !== seccionPrevia) {
    setSeccionPrevia(pathname);
    setTexto(searchParams.get("q") ?? "");
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function aplicar(q: string) {
    const destino = q.trim()
      ? `${base}?q=${encodeURIComponent(q.trim())}`
      : base;
    // En la misma sección reemplazamos (sin ensuciar el historial ni saltar el
    // scroll); desde otra pantalla navegamos una vez.
    if (yaEnBase) router.replace(destino, { scroll: false });
    else router.push(destino);
  }

  function onChange(q: string) {
    setTexto(q);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => aplicar(q), 350);
  }

  return (
    <header className="hidden h-[66px] shrink-0 items-center gap-4 border-b border-linea bg-card/80 px-[30px] text-card-foreground backdrop-blur lg:flex">
      <div className="min-w-0">
        <h1 className="text-xl leading-tight font-extrabold tracking-tight">
          {titulo}
        </h1>
        {subtitulo && (
          <p className="mt-0.5 text-[12.5px] text-muted-foreground first-letter:uppercase">
            {subtitulo}
          </p>
        )}
      </div>

      <div className="flex-1" />

      <div className="relative w-[280px]">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue" />
        <input
          type="search"
          value={texto}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            base === "/clientes"
              ? "Buscar cliente o teléfono…"
              : "Buscar cliente, teléfono, equipo…"
          }
          className="h-10 w-full rounded-xl border border-input bg-superficie-suave pr-3 pl-[38px] text-[13.5px] text-foreground outline-none placeholder:text-tenue focus:border-primary focus:bg-card focus:ring-[3px] focus:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      <Link
        href="/rentas/nueva"
        className="brand-gradient flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-bold whitespace-nowrap text-white shadow-[0_8px_18px_-10px_rgba(56,113,193,.9)] transition hover:brightness-105"
      >
        <Plus className="size-4" /> Nueva renta
      </Link>

      {esAdmin && (
        <Link
          href="/configuracion"
          title="Notificaciones"
          className="relative flex size-10 items-center justify-center rounded-xl border border-input bg-card text-medio transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Bell className="size-4" />
        </Link>
      )}
    </header>
  );
}
