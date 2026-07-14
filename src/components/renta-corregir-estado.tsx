"use client";

import { Settings2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { corregirEstadoRenta } from "@/lib/actions/rentas";
import { ESTADOS_RENTA, ESTADO_RENTA_META, type EstadoRentaStr } from "@/lib/rentas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Corrección de estado fuera del flujo normal (solo admin): TRANSICIONES solo
 * permite avanzar, así que un error de captura (p. ej. una renta marcada
 * CONCLUIDA que en realidad sigue CONFIRMADA) no se puede arreglar con los
 * botones de RentaAcciones. El server action revalida disponibilidad.
 */
export function RentaCorregirEstado({
  rentaId,
  estado,
}: {
  rentaId: string;
  estado: EstadoRentaStr;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState<EstadoRentaStr>(estado);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setNuevo(estado);
    setError(null);
    setAbierto(true);
  }

  function confirmar() {
    setError(null);
    start(async () => {
      const res = await corregirEstadoRenta(rentaId, nuevo as never);
      if ("error" in res) setError(res.error);
      else {
        setAbierto(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
      >
        <Settings2 className="size-3" /> Corregir estado
      </button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Corregir estado</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Salta el flujo normal (Cotizada → Confirmada → … → Concluida). Úsalo solo
            para arreglar un error de captura.
          </p>
          <Select value={nuevo} onValueChange={(v) => setNuevo(v as EstadoRentaStr)}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS_RENTA.map((e) => (
                <SelectItem key={e} value={e}>
                  {ESTADO_RENTA_META[e].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAbierto(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={pending || nuevo === estado}>
              {pending ? "Guardando…" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
