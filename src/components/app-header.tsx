import { LogOut } from "lucide-react";
import { cerrarSesion } from "@/lib/actions/auth";
import { AUTH_HABILITADA } from "@/lib/auth-flag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AppHeader({
  nombre,
  esAdmin,
}: {
  nombre: string;
  esAdmin: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold tracking-tight">Climaxpress</span>
        {/* El rol solo aplica con login activo. */}
        {AUTH_HABILITADA && (
          <Badge variant={esAdmin ? "default" : "secondary"}>
            {esAdmin ? "Admin" : "Repartidor"}
          </Badge>
        )}
      </div>
      {/* Nombre de usuario y cerrar sesión solo tienen sentido con login activo. */}
      {AUTH_HABILITADA && (
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {nombre}
          </span>
          <form action={cerrarSesion}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="Cerrar sesión"
            >
              <LogOut className="size-5" />
            </Button>
          </form>
        </div>
      )}
    </header>
  );
}
