import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  Package,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { AUTH_HABILITADA, USUARIO_POR_DEFECTO } from "@/lib/auth-flag";
import { cerrarSesion } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

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

const ADMIN_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/inventario", label: "Inventario", icon: Package },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export default async function MasPage() {
  const session = AUTH_HABILITADA ? await auth() : null;
  const usuario = session?.user ?? USUARIO_POR_DEFECTO;
  const esAdmin = usuario.rol === "ADMIN";
  const nombre = usuario.name ?? "Usuario";

  return (
    <div className="mx-auto max-w-md space-y-6 lg:hidden">
      <h1 className="text-[34px] leading-tight font-extrabold tracking-[-0.02em]">
        Más
      </h1>

      {/* Perfil */}
      <div className="flex items-center gap-3.5 rounded-[22px] bg-card p-4 shadow-[0_1px_2px_var(--border)]">
        <div className="flex size-13 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2f6dc0,#51ade5)] text-xl font-extrabold text-white">
          {iniciales(nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-extrabold tracking-tight">
            {nombre}
          </div>
          <div className="text-[13px] text-muted-foreground">
            {esAdmin ? "Administrador" : "Repartidor"}
          </div>
        </div>
      </div>

      {esAdmin && (
        <section className="space-y-2.5">
          <h2 className="px-1 text-[12.5px] font-extrabold tracking-wide text-muted-foreground uppercase">
            Administración
          </h2>
          <div className="overflow-hidden rounded-[22px] bg-card shadow-[0_1px_2px_var(--border)]">
            {ADMIN_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3.5 border-b border-border/60 px-4 py-3.5 last:border-b-0 active:bg-muted"
              >
                <Icon className="size-5 text-primary" strokeWidth={2} />
                <span className="flex-1 text-[15.5px] font-semibold">
                  {label}
                </span>
                <ChevronRight className="size-[18px] text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {AUTH_HABILITADA && (
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="h-[50px] w-full rounded-[15px] bg-card text-[15.5px] font-bold text-destructive shadow-[0_1px_2px_var(--border)] transition-transform active:scale-[0.98]"
          >
            Cerrar sesión
          </button>
        </form>
      )}
    </div>
  );
}
