"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navParaRol } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Navegación horizontal dentro del header. Solo aparece cuando hay ancho de
// sobra para que quepan todos los enlaces sin scroll; si no, BottomNav cubre
// ese rango (ver el breakpoint xl compartido entre ambos componentes).
export function HeaderNav({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname();
  const items = navParaRol(esAdmin);

  return (
    <nav className="hidden min-w-0 flex-1 overflow-hidden xl:block">
      <ul className="flex items-center justify-center gap-1 px-2">
        {items.map(({ href, label, icon: Icon }) => {
          const activo =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  activo
                    ? "bg-primary text-primary-foreground"
                    : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
