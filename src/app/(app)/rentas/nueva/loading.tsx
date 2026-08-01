import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Silueta del primer paso del alta (indicador + cliente + calendario + isla de
// acción), para que al cargar no haya salto. Misma regla que el resto de
// loading.tsx: la estructura es la real, el gris solo va por dentro.
export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-full rounded-xl" /> {/* indicador de pasos */}
      <Skeleton className="h-7 w-52" /> {/* título del paso */}
      <Skeleton className="h-11 w-full rounded-lg" /> {/* cliente */}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="border-b px-4 py-2.5">
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="m-3 h-[300px] rounded-xl" />
        <div className="border-t px-4 py-3">
          <Skeleton className="h-4 w-44" />
        </div>
      </Card>
      <Skeleton className="h-[68px] w-full rounded-2xl" /> {/* isla de acción */}
    </div>
  );
}
