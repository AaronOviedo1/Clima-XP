"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { eliminarPago } from "@/lib/actions/rentas";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Corrige un pago capturado por error (solo admin, ver renta-detalle.tsx).
export function PagoEliminarBoton({
  rentaId,
  pagoId,
}: {
  rentaId: string;
  pagoId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function eliminar() {
    start(async () => {
      const res = await eliminarPago(rentaId, pagoId);
      if (!("error" in res)) router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          aria-label="Eliminar pago"
          disabled={pending}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este pago?</AlertDialogTitle>
          <AlertDialogDescription>
            Úsalo solo para corregir un error de captura (p. ej. un pago que en
            realidad nunca se cobró). No se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="h-11 bg-destructive text-white hover:bg-destructive/90"
            onClick={eliminar}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
