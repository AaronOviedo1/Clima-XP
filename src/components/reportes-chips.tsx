"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export type ItemPeriodo = { href: string; label: string; activo: boolean };

/**
 * Fila de chips del filtro de periodo de /reportes (meses, semanas), con scroll
 * horizontal: doce meses no caben en un teléfono, y repartirlos como el
 * segmented control de años los dejaría ilegibles.
 *
 * Al cargar deja el chip activo a la vista. Sin eso, entrando directo a un mes
 * de fin de año la fila arranca en enero y no se ve cuál está elegido. Solo
 * mueve el propio contenedor (`block: "nearest"`), nunca la página.
 *
 * `sangrar` deja que el scroll llegue al borde de la pantalla cancelando el
 * padding del contenedor (vista móvil).
 */
export function ChipsPeriodo({
  items,
  sangrar = false,
}: {
  items: ItemPeriodo[];
  sangrar?: boolean;
}) {
  const activo = useRef<HTMLAnchorElement>(null);
  const hrefActivo = items.find((i) => i.activo)?.href;

  useEffect(() => {
    activo.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [hrefActivo]);

  if (items.length === 0) return null;

  return (
    <div
      className={`flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        sangrar ? "-mx-5 px-5" : ""
      }`}
    >
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          ref={t.activo ? activo : undefined}
          className={`flex h-8 shrink-0 items-center rounded-full px-3.5 text-[13px] font-bold whitespace-nowrap transition-colors ${
            t.activo
              ? "bg-primary text-primary-foreground"
              : "bg-superficie-suave text-medio hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
