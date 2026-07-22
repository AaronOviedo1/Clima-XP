import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TarjetaRentaSkeleton } from "@/components/skeletons";

// Skeleton de /ruta: selector de día, botón de Google Maps, paradas y mapa.
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2 lg:hidden">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-3.5 w-44" />
      </div>

      <Skeleton className="h-11 w-full rounded-xl" />

      <div className="space-y-2">
        <Skeleton className="h-13 w-full rounded-2xl" />
        <Skeleton className="h-3 w-64" />
      </div>

      <ol className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i}>
            <TarjetaRentaSkeleton />
          </li>
        ))}
      </ol>

      <Card className="gap-0 overflow-hidden py-0">
        <Skeleton className="h-80 rounded-none lg:h-[460px]" />
      </Card>
    </div>
  );
}
