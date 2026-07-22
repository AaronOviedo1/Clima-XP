import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Piezas de los `loading.tsx`. La regla: la estructura (Card, rejillas,
 * alturas) es la misma que la de la pantalla real y el gris solo va por dentro,
 * para que la carga tenga la silueta de la UI y no haya salto al aparecer los
 * datos. Las medidas están copiadas de las páginas correspondientes.
 */

// Encabezado móvil de las pantallas (en escritorio lo cubre el TopBar).
export function EncabezadoMovilSkeleton({
  conSaludo = false,
  conBoton = false,
  conSubtitulo = false,
}: {
  conSaludo?: boolean;
  conBoton?: boolean;
  conSubtitulo?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 lg:hidden">
      <div className="space-y-1.5">
        {conSaludo && <Skeleton className="h-4 w-28" />}
        <Skeleton className="h-8 w-40" />
        {conSubtitulo && <Skeleton className="h-3.5 w-48" />}
      </div>
      {conBoton && <Skeleton className="size-11 shrink-0 rounded-full" />}
    </div>
  );
}

// KPI con ícono cuadrado a la izquierda y dos líneas (dashboard e inventario).
export function KpiSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </Card>
  );
}

// Título de sección ("Entregas de hoy", "Modelos"…).
export function TituloSkeleton({ ancho = "w-44" }: { ancho?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <Skeleton className="size-[18px] rounded" />
      <Skeleton className={cn("h-4", ancho)} />
    </div>
  );
}

// Tarjeta de entrega/recolección (DashboardCard): datos, enlaces y acciones.
export function TarjetaRentaSkeleton() {
  return (
    <Card>
      <div className="space-y-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-28" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1 rounded-md" />
          <Skeleton className="h-8 flex-1 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 flex-1 rounded-md" />
          <Skeleton className="h-11 flex-1 rounded-md" />
        </div>
      </div>
    </Card>
  );
}

// Fila de lista dentro de una Card (rentas, clientes, mañana, saldos).
export function FilaListaSkeleton({
  avatar = "barra",
  conMonto = true,
}: {
  // "barra" = la barrita de color por día; "circulo" = avatar de iniciales.
  avatar?: "barra" | "circulo" | "ninguno";
  conMonto?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      {avatar === "barra" && <Skeleton className="h-[34px] w-1.5 shrink-0 rounded" />}
      {avatar === "circulo" && <Skeleton className="size-[42px] shrink-0 rounded-full" />}
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      {conMonto && <Skeleton className="h-4 w-16 shrink-0" />}
    </div>
  );
}

// Lista de n filas dentro de una sola Card (patrón iOS de las pantallas móviles).
export function ListaSkeleton({
  filas = 5,
  avatar = "barra",
  conMonto = true,
}: {
  filas?: number;
  avatar?: "barra" | "circulo" | "ninguno";
  conMonto?: boolean;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {Array.from({ length: filas }, (_, i) => (
        <FilaListaSkeleton key={i} avatar={avatar} conMonto={conMonto} />
      ))}
    </Card>
  );
}

// Segmented control / chips de filtro.
export function SegmentosSkeleton({ n = 3 }: { n?: number }) {
  return (
    <div className="flex gap-1 rounded-xl bg-muted p-1">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className="h-9 flex-1 rounded-[9px]" />
      ))}
    </div>
  );
}
