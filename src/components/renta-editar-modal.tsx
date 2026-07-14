"use client";

import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Envoltura del editor de renta cuando se abre como pop-up (ruta interceptada
 * de /rentas/[id]/editar). Al cerrarse regresa al detalle.
 */
export function RentaEditarModal({
  rentaId,
  children,
}: {
  rentaId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname !== `/rentas/${rentaId}/editar`) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent
        aria-describedby={undefined}
        overlayClassName="backdrop-blur-md bg-black/30"
        // pb-0: la barra de total del formulario se pega al borde inferior.
        className="no-scrollbar max-h-[85dvh] overflow-y-auto overflow-x-hidden pb-0 sm:max-w-lg"
      >
        <DialogTitle>Editar renta</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
