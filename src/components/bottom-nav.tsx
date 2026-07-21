"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RUTAS_MAS, tabsParaRol, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

function activo(item: NavItem, pathname: string) {
  if (item.href === "/mas") return RUTAS_MAS.some((r) => pathname.startsWith(r));
  if (item.href === "/") return pathname === "/";
  return pathname.startsWith(item.href);
}

/**
 * Tab bar flotante estilo iOS (diseño Clima-XP Móvil). Solo móvil (`lg:hidden`
 * lo aplica el layout). Fondo con blur, ícono + etiqueta, activo en primary.
 */
export function BottomNav({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname();
  const tabs = tabsParaRol(esAdmin);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/80 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+10px)] backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md items-stretch">
        {tabs.map((item) => {
          const on = activo(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-1 transition-transform active:scale-90",
                  on ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-6" strokeWidth={1.9} aria-hidden />
                <span className="text-[10.5px] font-semibold">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
