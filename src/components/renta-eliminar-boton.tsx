"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { eliminarRenta } from "@/lib/actions/rentas";
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

/**
 * Borra la renta de verdad (solo admin): para capturas de prueba o errores.
 * Cancelar sigue siendo lo correcto cuando la renta sí existió — por eso el
 * diálogo lo dice y avisa de los pagos que se van con ella.
 */
export function RentaEliminarBoton({
  rentaId,
  resumen,
  pagos = 0,
}: {
  rentaId: string;
  resumen: string;
  pagos?: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pending, start] = useTransition();

  function eliminar() {
    start(async () => {
      const res = await eliminarRenta(rentaId);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success("Renta eliminada");
        setAbierto(false);
        router.replace("/rentas");
        router.refresh();
      }
    });
  }

  return (
    <AlertDialog open={abierto} onOpenChange={setAbierto}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" /> Eliminar renta
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar esta renta?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Se borra por completo <strong>{resumen}</strong>: desaparece del
                historial, del calendario y de los reportes. No se puede deshacer.
              </p>
              {pagos > 0 && (
                <p>
                  También se eliminan {pagos === 1 ? "el pago registrado" : `los ${pagos} pagos registrados`}.
                </p>
              )}
              <p>
                Úsalo solo para rentas de prueba o capturadas por error. Si la renta
                sí existió y se cayó, márcala como <strong>Cancelada</strong>.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11" disabled={pending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-11 bg-destructive text-white hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault(); // que el diálogo no cierre antes de que responda
              eliminar();
            }}
            disabled={pending}
          >
            {pending ? "Eliminando…" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
