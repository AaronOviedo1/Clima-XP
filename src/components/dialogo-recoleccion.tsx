"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { accesoriosDeRenta, type AccesorioOpcion } from "@/lib/actions/rentas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const TITULO_TIPO: Record<string, string> = {
  MANGUERA: "Mangueras",
  EXTENSION: "Extensiones",
  TAMBO_GAS: "Tambos de gas",
};

/**
 * Diálogo "¿Se recogió todo?": muestra los accesorios que salieron con la renta
 * (los que se capturaron al entregar) marcados como recogidos, y deja
 * desmarcar lo que se quedó en casa del cliente.
 *
 * Lo que falte no traba la renta —el equipo se libera igual—, pero se anota en
 * ella; si no, la manguera que se quedó se pierde sin rastro.
 *
 * El padre solo abre el diálogo cuando la renta tiene accesorios: sin nada que
 * revisar, "Recogido" sigue siendo de un tap.
 */
export function DialogoRecoleccion({
  rentaId,
  abierto,
  onOpenChange,
  onConfirmar,
  pending,
  error,
}: {
  rentaId: string;
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  // Recibe los accesorios que NO se recogieron.
  onConfirmar: (noRecogidos: string[]) => void;
  pending: boolean;
  error?: string | null;
}) {
  const [accesorios, setAccesorios] = useState<AccesorioOpcion[] | null>(null);
  const [faltantes, setFaltantes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!abierto || accesorios) return;
    accesoriosDeRenta(rentaId).then(setAccesorios);
  }, [abierto, accesorios, rentaId]);

  const grupos = useMemo(() => {
    const map = new Map<string, AccesorioOpcion[]>();
    for (const a of accesorios ?? []) {
      const arr = map.get(a.tipo) ?? [];
      arr.push(a);
      map.set(a.tipo, arr);
    }
    return [...map.entries()];
  }, [accesorios]);

  function toggle(id: string) {
    setFaltantes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const listaFaltantes = (accesorios ?? []).filter((a) => faltantes.has(a.id));

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>¿Se recogió todo?</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Esto se dejó en la entrega. Desmarca lo que no haya regresado.
        </p>

        <div className="space-y-3">
          {accesorios === null ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : grupos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se registraron accesorios en la entrega.
            </p>
          ) : (
            grupos.map(([tipo, items]) => (
              <div key={tipo} className="space-y-1.5">
                <p className="text-sm font-medium">{TITULO_TIPO[tipo] ?? tipo}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map((a) => {
                    const recogido = !faltantes.has(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggle(a.id)}
                        aria-pressed={recogido}
                        className={
                          "flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors " +
                          (recogido
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-dashed text-muted-foreground line-through hover:bg-muted")
                        }
                      >
                        {recogido && <Check className="size-3.5" />}
                        {a.codigo ?? a.descripcion}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {listaFaltantes.length > 0 && (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            Se anotará en la renta que quedó sin recoger:{" "}
            {listaFaltantes.map((a) => a.codigo ?? a.descripcion).join(", ")}.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirmar([...faltantes])} disabled={pending}>
            {pending
              ? "Guardando…"
              : listaFaltantes.length > 0
                ? "Recogido con faltantes"
                : "Se recogió todo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
