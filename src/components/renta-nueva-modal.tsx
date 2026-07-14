"use client";

import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Envoltura del alta de renta cuando se abre como pop-up (ruta interceptada de
 * /rentas/nueva). Al cerrarse regresa a la lista.
 *
 * El guard de pathname evita que la ranura paralela siga mostrando el pop-up
 * después de navegar a otra ruta (los slots conservan su contenido).
 */
export function RentaNuevaModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname !== "/rentas/nueva") return null;

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent
        aria-describedby={undefined}
        overlayClassName="backdrop-blur-md bg-black/30"
        // pb-0: la barra de total del formulario se pega al borde inferior.
        className="no-scrollbar max-h-[85dvh] overflow-y-auto overflow-x-hidden pb-0 sm:max-w-lg"
      >
        <DialogTitle>Nueva renta</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
