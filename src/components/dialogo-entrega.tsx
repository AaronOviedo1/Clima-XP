"use client";

import { useEffect, useMemo, useState } from "react";
import {
  accesoriosParaEquipos,
  type AccesorioOpcion,
} from "@/lib/actions/rentas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// Qué accesorios aplican a cada tipo de equipo (para agruparlos en el diálogo).
const TIPO_ACCESORIO_INFO: Record<string, { titulo: string }> = {
  MANGUERA: { titulo: "Mangueras" },
  EXTENSION: { titulo: "Extensiones" },
  TAMBO_GAS: { titulo: "Tambos de gas" },
};

// Diálogo "¿Qué se entregó?": ofrece los accesorios de los tipos de equipo de
// la renta y devuelve los ids seleccionados. El padre decide qué action correr
// en onConfirmar (marcarEntregada) y controla apertura/pending/error.
export function DialogoEntrega({
  tiposEquipo,
  abierto,
  onOpenChange,
  onConfirmar,
  pending,
  error,
}: {
  tiposEquipo: string[];
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  onConfirmar: (accesorioIds: string[]) => void;
  pending: boolean;
  error?: string | null;
}) {
  const [accesorios, setAccesorios] = useState<AccesorioOpcion[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());

  // Cargar el catálogo de accesorios solo cuando se abre el diálogo.
  useEffect(() => {
    if (!abierto || accesorios) return;
    accesoriosParaEquipos(tiposEquipo).then(setAccesorios);
  }, [abierto, accesorios, tiposEquipo]);

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
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>¿Qué se entregó?</DialogTitle>
        <div className="space-y-3">
          {accesorios === null ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : grupos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay accesorios registrados para este equipo.
            </p>
          ) : (
            grupos.map(([tipo, items]) => (
              <div key={tipo} className="space-y-1.5">
                <p className="text-sm font-medium">
                  {TIPO_ACCESORIO_INFO[tipo]?.titulo ?? tipo}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((a) => {
                    const activo = sel.has(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggle(a.id)}
                        className={
                          "rounded-md border px-3 py-2 text-sm font-medium transition-colors " +
                          (activo
                            ? "border-primary bg-primary text-primary-foreground"
                            : "hover:bg-muted")
                        }
                      >
                        {a.codigo ?? a.descripcion}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={() => onConfirmar([...sel])} disabled={pending}>
            {pending ? "Guardando…" : "Confirmar entrega"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
