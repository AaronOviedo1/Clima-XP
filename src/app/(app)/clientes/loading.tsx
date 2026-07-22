import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EncabezadoMovilSkeleton, ListaSkeleton } from "@/components/skeletons";
import { GRID_CLIENTES } from "@/lib/grids";
import { cn } from "@/lib/utils";

// Skeleton de /clientes: tabla con la misma rejilla en escritorio y filas con
// avatar circular en móvil.
export default function Loading() {
  return (
    <div className="space-y-5">
      <EncabezadoMovilSkeleton conBoton />

      <div className="flex items-center gap-2">
        <div className="flex-1 lg:hidden">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      {/* Tabla (escritorio). */}
      <Card className="hidden overflow-hidden py-0 lg:block">
        <div className={cn(GRID_CLIENTES, "border-b border-linea bg-superficie-suave px-[22px] py-3.5")}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className={cn(GRID_CLIENTES, "items-center border-b border-linea-suave px-[22px] py-3.5")}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-[38px] shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-6 justify-self-end" />
          </div>
        ))}
      </Card>

      {/* Lista (móvil). */}
      <div className="lg:hidden">
        <ListaSkeleton filas={8} avatar="circulo" conMonto={false} />
      </div>
    </div>
  );
}
