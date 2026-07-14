"use client";

import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Envoltura del detalle de renta cuando se abre como pop-up (ruta interceptada).
 * Al cerrarse regresa a la pantalla anterior; si se navega a otra ruta desde
 * dentro (editar, cliente), el pop-up se oculta solo.
 */
export function RentaModal({
  rentaId,
  children,
}: {
  rentaId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // La ranura @modal conserva su estado en navegaciones suaves; si la URL ya
  // no es la de esta renta, no renderizar nada.
  if (pathname !== `/rentas/${rentaId}`) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent
        aria-describedby={undefined}
        overlayClassName="backdrop-blur-md bg-black/30"
        className="no-scrollbar max-h-[85dvh] overflow-y-auto overflow-x-hidden sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Detalle de renta</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
