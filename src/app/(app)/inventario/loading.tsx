import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiSkeleton, TituloSkeleton } from "@/components/skeletons";

// Tarjeta de modelo: nombre, precio, disponibles y barra de ocupación.
function ModeloSkeleton() {
  return (
    <Card className="gap-0 py-0">
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-28" />
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </Card>
  );
}

// Skeleton de /inventario: KPIs (3 en móvil, 4 en escritorio) y modelos.
export default function Loading() {
  return (
    <>
      {/* MÓVIL */}
      <div className="space-y-6 lg:hidden">
        <Skeleton className="h-8 w-44" />

        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="items-center gap-2 py-4">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-16" />
            </Card>
          ))}
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
          {Array.from({ length: 4 }, (_, i) => (
            <ModeloSkeleton key={i} />
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-40 rounded-md" />
          </div>
          <Card className="gap-0 py-0">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 border-b p-4 last:border-b-0">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-8" />
              </div>
            ))}
          </Card>
        </section>
      </div>

      {/* ESCRITORIO */}
      <div className="hidden space-y-6 lg:block">
        <div className="flex justify-end">
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>

        {Array.from({ length: 2 }, (_, s) => (
          <section key={s} className="space-y-3.5">
            <TituloSkeleton ancho="w-36" />
            <div className="grid gap-4 lg:grid-cols-2">
              <ModeloSkeleton />
              <ModeloSkeleton />
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
