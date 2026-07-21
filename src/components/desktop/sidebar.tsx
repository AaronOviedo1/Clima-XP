"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { navParaRol } from "@/lib/nav";
import { cerrarSesion } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

function esRutaActiva(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function iniciales(nombre: string) {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "CX"
  );
}

/**
 * Sidebar oscuro fijo del shell de escritorio (diseño ClimaXpress Desktop).
 * Solo visible en `lg+`; en móvil la navegación sigue en BottomNav.
 */
export function Sidebar({
  nombre,
  esAdmin,
  authHabilitada,
}: {
  nombre: string;
  esAdmin: boolean;
  authHabilitada: boolean;
}) {
  const pathname = usePathname();
  const items = navParaRol(esAdmin);

  return (
    <aside className="sidebar-gradient hidden w-60 shrink-0 flex-col px-3.5 pt-4 pb-3.5 text-white lg:flex">
      <div className="flex items-center justify-center px-2 pt-2 pb-5">
        <Image
          src="/logo-app.png"
          alt="ClimaXpress"
          width={1290}
          height={842}
          priority
          className="h-20 w-auto"
        />
      </div>

      <div className="px-2.5 pt-1 pb-2 text-[11px] font-bold tracking-[0.09em] text-white/40">
        MENÚ
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const activo = esRutaActiva(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors",
                activo
                  ? "brand-gradient text-white shadow-[0_8px_18px_-8px_rgba(56,113,193,.9)]"
                  : "text-white/60 hover:text-white",
              )}
            >
              <span className="flex w-5 justify-center">
                <Icon className="size-[19px]" aria-hidden />
              </span>
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      {authHabilitada && (
        <div className="mt-2 flex items-center gap-2.5 border-t border-white/10 p-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#51ADE5,#3871C1)] text-sm font-extrabold">
            {iniciales(nombre)}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13.5px] font-bold">{nombre}</div>
            <div className="text-[11.5px] text-white/50">
              {esAdmin ? "Administrador" : "Repartidor"}
            </div>
          </div>
          <form action={cerrarSesion}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="flex rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-[17px]" />
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
