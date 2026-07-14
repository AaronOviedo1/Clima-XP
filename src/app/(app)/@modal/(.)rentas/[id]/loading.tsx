"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

// Los slots paralelos no heredan el loading del segmento: sin este archivo,
// el click en una renta se queda congelado hasta que la BD responde.
export default function LoadingModal() {
  const router = useRouter();
  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent
        aria-describedby={undefined}
        overlayClassName="backdrop-blur-md bg-black/30"
        className="no-scrollbar max-h-[85dvh] overflow-y-auto overflow-x-hidden sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Cargando renta…</DialogTitle>
        <div className="space-y-4">
          <div className="space-y-2 pr-8">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
