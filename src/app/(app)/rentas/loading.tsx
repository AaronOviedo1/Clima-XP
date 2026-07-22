import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EncabezadoMovilSkeleton,
  ListaSkeleton,
  SegmentosSkeleton,
} from "@/components/skeletons";
import { GRID_RENTAS } from "@/lib/grids";
import { cn } from "@/lib/utils";

// Skeleton de /rentas: buscador + segmentos en móvil (chips en escritorio) y
// los grupos por semana, con la misma rejilla de columnas de la tabla.
export default function Loading() {
  return (
    <div className="space-y-5">
      <EncabezadoMovilSkeleton conBoton />
      <div className="lg:hidden">
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
      <div className="lg:hidden">
        <SegmentosSkeleton />
      </div>

      {/* Chips de estado (escritorio). */}
      <div className="hidden flex-wrap gap-2 lg:flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-[10px]" />
        ))}
      </div>

      {/* Tabla por semana (escritorio). */}
      <Card className="hidden overflow-hidden py-0 lg:block">
        <div className={cn(GRID_RENTAS, "border-b border-linea px-5 py-2.5")}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
        <div className="flex items-center justify-between bg-superficie-activa px-5 py-3.5">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={cn(GRID_RENTAS, "items-center border-t border-linea-suave px-5 py-3.5")}>
            <Skeleton className="h-8 w-[14px] rounded" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-4 w-16 justify-self-end" />
          </div>
        ))}
      </Card>

      {/* Grupos por semana (móvil). */}
      <div className="space-y-4 lg:hidden">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 px-1 py-1.5">
              <Skeleton className="size-3.5 rounded" />
              <Skeleton className="h-3.5 w-32" />
              <span className="flex-1" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            <div className="mt-1.5">
              <ListaSkeleton filas={4} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
