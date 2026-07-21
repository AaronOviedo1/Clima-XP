"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
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
  const [titulo, subtituloBase] = metaDeRuta(pathname);
  const subtitulo = pathname === "/" ? fechaHoy : subtituloBase;

  function buscar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q")?.toString().trim() ?? "";
    router.push(q ? `/rentas?q=${encodeURIComponent(q)}` : "/rentas");
  }

  return (
    <header className="hidden h-[66px] shrink-0 items-center gap-4 border-b border-[#e3eaf4] bg-white/80 px-[30px] backdrop-blur lg:flex">
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

      <form onSubmit={buscar} className="relative w-[280px]">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#94a3b8]" />
        <input
          name="q"
          placeholder="Buscar cliente, teléfono, equipo…"
          className="h-10 w-full rounded-xl border border-[#e0e8f3] bg-[#f5f8fc] pr-3 pl-[38px] text-[13.5px] outline-none focus:border-primary focus:bg-white focus:ring-[3px] focus:ring-primary/15"
        />
      </form>

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
          className="relative flex size-10 items-center justify-center rounded-xl border border-[#e0e8f3] bg-white text-[#5a6b82] transition-colors hover:border-[#c9d6e8] hover:text-foreground"
        >
          <Bell className="size-4" />
        </Link>
      )}
    </header>
  );
}
