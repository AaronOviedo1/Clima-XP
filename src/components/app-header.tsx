import Image from "next/image";
import { LogOut } from "lucide-react";
import { cerrarSesion } from "@/lib/actions/auth";
import { AUTH_HABILITADA } from "@/lib/auth-flag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeaderNav } from "@/components/header-nav";

export function AppHeader({
  nombre,
  esAdmin,
}: {
  nombre: string;
  esAdmin: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/10 bg-[#152b47]/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-[#152b47]/90">
      <div className="flex shrink-0 items-center gap-2">
        <Image
          src="/logo-app.png"
          alt="ClimaXpress"
          width={1290}
          height={842}
          priority
          className="h-20 w-auto"
        />
        {/* El rol solo aplica con login activo. */}
        {AUTH_HABILITADA && (
          <Badge variant={esAdmin ? "default" : "secondary"}>
            {esAdmin ? "Admin" : "Repartidor"}
          </Badge>
        )}
      </div>
      {/* Opciones de navegación en la barra (solo escritorio; en móvil está BottomNav). */}
      <HeaderNav esAdmin={esAdmin} />
      {/* Nombre de usuario y cerrar sesión solo tienen sentido con login activo. */}
      {AUTH_HABILITADA && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden text-sm text-white/75 sm:inline">
            {nombre}
          </span>
          <form action={cerrarSesion}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="Cerrar sesión"
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-5" />
            </Button>
          </form>
        </div>
      )}
    </header>
  );
}
