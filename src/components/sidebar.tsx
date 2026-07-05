"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navParaRol } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Navegación lateral para escritorio/web (oculta en móvil, donde se usa BottomNav).
export function Sidebar({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname();
  const items = navParaRol(esAdmin);

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-muted/20 md:block">
      <nav className="sticky top-14 p-3">
        <ul className="space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const activo =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    activo
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4.5 shrink-0" aria-hidden />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
