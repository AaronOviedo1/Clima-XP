"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OrdenClientes = "nombre" | "rentas";

// Alterna el orden del directorio entre alfabético (default) y "los que más
// han rentado", sincronizando ?orden= sin perder el resto de la URL (?q=).
// El filtrado y el orden ocurren en el server component.
export function ClientesOrden({
  orden,
  className,
}: {
  orden: OrdenClientes;
  // Para que el botón adopte el tamaño del TopBar cuando vive en el navbar.
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const porRentas = orden === "rentas";

  function alternar() {
    const sp = new URLSearchParams(searchParams);
    if (porRentas) sp.delete("orden");
    else sp.set("orden", "rentas");
    const s = sp.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  return (
    // h-8 iguala al trigger de edición masiva en móvil; en el TopBar lo pisa
    // el h-10 de CLASE_ACCION_TOP_BAR.
    <Button
      variant="outline"
      size="sm"
      onClick={alternar}
      title={
        porRentas
          ? "Orden: los que más han rentado (tocar para A-Z)"
          : "Orden: alfabético (tocar para los que más han rentado)"
      }
      className={cn(
        "h-8",
        className,
        // El orden que no es el default se marca, como el día "Hoy" de /ruta.
        // Va al final a propósito: CLASE_ACCION_TOP_BAR trae border-input y
        // text-foreground, y en el TopBar le ganarían al marcado.
        porRentas && "border-primary/60 text-primary",
      )}
    >
      <ChevronsUpDown className="size-4" />
      {porRentas ? "Más rentas" : "A-Z"}
    </Button>
  );
}
