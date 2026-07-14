"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingEditarModal() {
  const router = useRouter();
  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent
        aria-describedby={undefined}
        overlayClassName="backdrop-blur-md bg-black/30"
        className="no-scrollbar max-h-[85dvh] overflow-y-auto overflow-x-hidden sm:max-w-lg"
      >
        <DialogTitle>Editar renta</DialogTitle>
        <div className="space-y-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
