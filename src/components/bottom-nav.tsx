"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { navMovil, type NavItem } from "@/lib/nav";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function esRutaActiva(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// Cubre desde móvil hasta que HeaderNav tiene ancho de sobra (xl) para
// mostrar todos los enlaces sin scroll.
export function BottomNav({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const { principales, extras } = navMovil(esAdmin);

  // El repartidor cabe entero en la barra: sin extras no hay botón "Más".
  const hayExtras = extras.length > 0;
  const enExtras = extras.some((i) => esRutaActiva(i.href, pathname));

  // El padding de abajo libera el indicador de inicio del iPhone, que instalada
  // como PWA queda encima de los botones.
  return (
    <nav className="sticky bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 xl:hidden">
      <ul className="flex items-stretch">
        {principales.map((item) => (
          <li key={item.href} className="flex-1">
            <EnlaceBarra item={item} activo={esRutaActiva(item.href, pathname)} />
          </li>
        ))}

        {hayExtras && (
          <li className="flex-1">
            <Popover open={abierto} onOpenChange={setAbierto}>
              <PopoverTrigger
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                  enExtras || abierto
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <MoreHorizontal className="size-5" aria-hidden />
                <span>Más</span>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                sideOffset={8}
                className="w-56 gap-1 p-1.5"
              >
                {extras.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setAbierto(false)}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                      esRutaActiva(href, pathname)
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span>{label}</span>
                  </Link>
                ))}
              </PopoverContent>
            </Popover>
          </li>
        )}
      </ul>
    </nav>
  );
}

function EnlaceBarra({ item, activo }: { item: NavItem; activo: boolean }) {
  const { href, label, icon: Icon } = item;
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
        activo ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}
