import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RentaNueva } from "@/components/renta-nueva";
import { RentaNuevaModal } from "@/components/renta-nueva-modal";

export const dynamic = "force-dynamic";

// Segmento literal: gana sobre el interceptor (.)rentas/[id], que si no trataría
// "nueva" como el id de una renta. Al venir por soft-nav desde /rentas, Next
// intercepta la navegación y el alta se abre como pop-up sobre la lista; una
// carga directa de /rentas/nueva no se intercepta y cae en la pantalla completa.
//
// Un solo Dialog: el pop-up se monta al instante y el alta se carga dentro de un
// <Suspense> (ver nota en (.)rentas/[id]/page.tsx). Sin loading.tsx aparte.
export default async function NuevaRentaModalPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;

  return (
    <RentaNuevaModal>
      <Suspense fallback={<FormSkeleton />}>
        <RentaNueva clientePreseleccionado={cliente} enModal />
      </Suspense>
    </RentaNuevaModal>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
