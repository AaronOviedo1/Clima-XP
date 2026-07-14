"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navParaRol } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Cubre desde móvil hasta que HeaderNav tiene ancho de sobra (xl) para
// mostrar todos los enlaces sin scroll.
export function BottomNav({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname();
  const items = navParaRol(esAdmin);

  // El padding de abajo libera el indicador de inicio del iPhone, que instalada
  // como PWA queda encima de los botones.
  return (
    <nav className="sticky bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 xl:hidden">
      <ul className="flex items-stretch overflow-x-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const activo =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1 shrink-0">
              <Link
                href={href}
                className={cn(
                  "flex min-w-16 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                  activo
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
