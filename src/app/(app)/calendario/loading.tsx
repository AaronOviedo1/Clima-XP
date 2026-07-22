import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton de /calendario: barra de mes + cuadrícula de semanas (celdas chicas
// en móvil, celdas altas de 104px en escritorio, como CalendarioMes).
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2 lg:hidden">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-3.5 w-52" />
      </div>

      <div className="flex items-center gap-3.5">
        <Skeleton className="h-6 w-40" />
        <div className="flex-1" />
        <Skeleton className="size-10 rounded-md" />
        <Skeleton className="size-10 rounded-md" />
      </div>

      {/* Cuadrícula móvil. */}
      <Card className="gap-0 py-3.5 lg:hidden">
        <div className="grid grid-cols-7 px-2">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex justify-center pb-2">
              <Skeleton className="h-3 w-4" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1.5 px-2">
          {Array.from({ length: 42 }, (_, i) => (
            <div key={i} className="flex justify-center">
              <Skeleton className="size-11 rounded-full" />
            </div>
          ))}
        </div>
      </Card>

      {/* Cuadrícula escritorio. */}
      <Card className="hidden p-3 lg:block">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="min-h-[104px] rounded-xl" />
          ))}
        </div>
      </Card>
    </div>
  );
}
