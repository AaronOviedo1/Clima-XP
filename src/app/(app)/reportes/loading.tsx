import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentosSkeleton } from "@/components/skeletons";

// KPI de reportes (escritorio): etiqueta chica arriba, número grande abajo.
function KpiReporteSkeleton() {
  return (
    <Card className="gap-0 p-[18px]">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-2.5 h-7 w-32" />
    </Card>
  );
}

// Bloque de gráfica de barras (escritorio): título + barras horizontales.
function SeccionSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-44" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Skeleton de /reportes: hero + tiles + gráficas en móvil, KPIs + secciones en
// escritorio.
export default function Loading() {
  return (
    <>
      {/* MÓVIL */}
      <div className="lg:hidden">
        <Skeleton className="h-8 w-40" />

        <div className="mt-4">
          <SegmentosSkeleton n={4} />
        </div>

        {/* Hero de facturación. */}
        <Skeleton className="mt-4 h-[132px] w-full rounded-[22px]" />

        <div className="mt-3.5 flex flex-wrap gap-[9px]">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex-1 space-y-2 rounded-2xl bg-card p-[13px] shadow-sm">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        <Skeleton className="mt-6 mb-3 h-3 w-32" />
        <div className="rounded-[18px] bg-card p-[18px_14px_12px] shadow-sm">
          <div className="flex h-[120px] items-end justify-between gap-1">
            {[45, 70, 30, 90, 55, 75, 40, 60].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <Skeleton className="w-full rounded-t-[5px]" style={{ height: `${h}px` }} />
                <Skeleton className="h-2 w-5" />
              </div>
            ))}
          </div>
        </div>

        <Skeleton className="mt-6 mb-3 h-3 w-40" />
        <div className="space-y-2.5 rounded-[18px] bg-card p-4 shadow-sm">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* ESCRITORIO */}
      <div className="hidden space-y-5 lg:block">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <KpiReporteSkeleton key={i} />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <SeccionSkeleton />
          <SeccionSkeleton />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SeccionSkeleton />
          <SeccionSkeleton />
        </div>

        <SeccionSkeleton />
      </div>
    </>
  );
}
