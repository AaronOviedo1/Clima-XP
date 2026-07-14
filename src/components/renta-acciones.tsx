"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cambiarEstadoRenta,
  marcarEntregada,
  accesoriosParaEquipos,
  type AccesorioOpcion,
} from "@/lib/actions/rentas";
import {
  TRANSICIONES,
  ACCION_ESTADO,
  type EstadoRentaStr,
} from "@/lib/rentas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// Qué accesorios aplican a cada tipo de equipo (para agruparlos en el diálogo).
const TIPO_ACCESORIO_INFO: Record<string, { titulo: string; equipo: string }> = {
  MANGUERA: { titulo: "Mangueras", equipo: "AEROCOOLER" },
  EXTENSION: { titulo: "Extensiones", equipo: "AEROCOOLER" },
  TAMBO_GAS: { titulo: "Tambos de gas", equipo: "CALENTON" },
};

export function RentaAcciones({
  rentaId,
  estado,
  tiposEquipo,
}: {
  rentaId: string;
  estado: EstadoRentaStr;
  // Tipos de equipo de esta renta (AEROCOOLER/CALENTON): decide qué accesorios
  // ofrecer al marcar la entrega.
  tiposEquipo: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [accesorios, setAccesorios] = useState<AccesorioOpcion[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const destinos = TRANSICIONES[estado] ?? [];

  // Cargar el catálogo de accesorios solo cuando se abre el diálogo de entrega.
  useEffect(() => {
    if (!dialogAbierto || accesorios) return;
    accesoriosParaEquipos(tiposEquipo).then(setAccesorios);
  }, [dialogAbierto, accesorios, tiposEquipo]);

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

  function ir(destino: EstadoRentaStr) {
    setError(null);
    start(async () => {
      const res = await cambiarEstadoRenta(rentaId, destino);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  }

  function confirmarEntrega() {
    setError(null);
    start(async () => {
      const res = await marcarEntregada(rentaId, [...sel]);
      if ("error" in res) setError(res.error);
      else {
        setDialogAbierto(false);
        router.refresh();
      }
    });
  }

  if (destinos.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {destinos.map((d) => {
          const cancelar = d === "CANCELADA";
          const esEntrega = d === "ENTREGADA";
          return (
            <Button
              key={d}
              variant={cancelar ? "outline" : "default"}
              className={"h-11 flex-1 " + (cancelar ? "text-destructive" : "")}
              disabled={pending}
              onClick={() => (esEntrega ? setDialogAbierto(true) : ir(d))}
            >
              {ACCION_ESTADO[d]}
            </Button>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogAbierto(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={confirmarEntrega} disabled={pending}>
              {pending ? "Guardando…" : "Confirmar entrega"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
