import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RentaEditar } from "@/components/renta-editar";
import { RentaEditarModal } from "@/components/renta-editar-modal";

export const dynamic = "force-dynamic";

// Un solo Dialog: el pop-up se monta al instante y el editor se carga dentro de
// un <Suspense> (ver nota en (.)rentas/[id]/page.tsx). Sin loading.tsx aparte.
export default async function EditarRentaModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RentaEditarModal rentaId={id}>
      <Suspense fallback={<FormSkeleton />}>
        <RentaEditar id={id} enModal />
      </Suspense>
    </RentaEditarModal>
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
