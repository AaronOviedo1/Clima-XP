"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cambiarEstadoRenta, marcarEntregada, marcarRecogida } from "@/lib/actions/rentas";
import {
  TRANSICIONES,
  ACCION_ESTADO,
  type EstadoRentaStr,
} from "@/lib/rentas";
import { Button } from "@/components/ui/button";
import { DialogoEntrega } from "@/components/dialogo-entrega";
import { DialogoRecoleccion } from "@/components/dialogo-recoleccion";

// Mensaje de confirmación (toast) por estado destino.
const TOAST_ESTADO: Record<EstadoRentaStr, string> = {
  COTIZADA: "Marcada como cotización",
  CONFIRMADA: "Renta confirmada",
  EN_RUTA: "En ruta",
  ENTREGADA: "Renta entregada",
  RECOGIDA: "Recolección hecha",
  CONCLUIDA: "Renta concluida",
  CANCELADA: "Renta cancelada",
};

export function RentaAcciones({
  rentaId,
  estado,
  tiposEquipo,
  accesoriosEntregados = 0,
}: {
  rentaId: string;
  estado: EstadoRentaStr;
  // Tipos de equipo de esta renta (AEROCOOLER/CALENTON): decide qué accesorios
  // ofrecer al marcar la entrega.
  tiposEquipo: string[];
  // Cuántos accesorios salieron con la renta: con cero no hay nada que revisar
  // al recoger y el botón sigue siendo de un tap.
  accesoriosEntregados?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [dialogRecoleccion, setDialogRecoleccion] = useState(false);

  const destinos = TRANSICIONES[estado] ?? [];

  function ir(destino: EstadoRentaStr) {
    setError(null);
    start(async () => {
      const res = await cambiarEstadoRenta(rentaId, destino);
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(TOAST_ESTADO[destino]);
        router.refresh();
      }
    });
  }

  function confirmarRecoleccion(noRecogidos: string[]) {
    setError(null);
    start(async () => {
      const res = await marcarRecogida(rentaId, noRecogidos);
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        if (res.aviso) toast.warning(res.aviso);
        toast.success("Recolección hecha");
        setDialogRecoleccion(false);
        router.refresh();
      }
    });
  }

  function confirmarEntrega(accesorioIds: string[]) {
    setError(null);
    start(async () => {
      const res = await marcarEntregada(rentaId, accesorioIds);
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Renta entregada");
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
          // Al recoger se revisan los accesorios que salieron con la renta.
          const esRecoleccion = d === "RECOGIDA" && accesoriosEntregados > 0;
          return (
            <Button
              key={d}
              variant={cancelar ? "outline" : "default"}
              className={"h-11 flex-1 " + (cancelar ? "text-destructive" : "")}
              disabled={pending}
              onClick={() =>
                esEntrega
                  ? setDialogAbierto(true)
                  : esRecoleccion
                    ? setDialogRecoleccion(true)
                    : ir(d)
              }
            >
              {/* Desde una cotización, "Confirmar" es en realidad aceptarla:
                  es cuando el equipo se aparta de verdad. */}
              {estado === "COTIZADA" && d === "CONFIRMADA"
                ? "Convertir en renta"
                : ACCION_ESTADO[d]}
            </Button>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogoEntrega
        tiposEquipo={tiposEquipo}
        abierto={dialogAbierto}
        onOpenChange={setDialogAbierto}
        onConfirmar={confirmarEntrega}
        pending={pending}
      />

      <DialogoRecoleccion
        rentaId={rentaId}
        abierto={dialogRecoleccion}
        onOpenChange={setDialogRecoleccion}
        onConfirmar={confirmarRecoleccion}
        pending={pending}
      />
    </div>
  );
}
