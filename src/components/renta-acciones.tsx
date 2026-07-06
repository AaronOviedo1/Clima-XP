"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoRenta } from "@/lib/actions/rentas";
import {
  TRANSICIONES,
  ACCION_ESTADO,
  type EstadoRentaStr,
} from "@/lib/rentas";
import { Button } from "@/components/ui/button";

export function RentaAcciones({
  rentaId,
  estado,
}: {
  rentaId: string;
  estado: EstadoRentaStr;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const destinos = TRANSICIONES[estado] ?? [];
  if (destinos.length === 0) return null;

  function ir(destino: EstadoRentaStr) {
    setError(null);
    start(async () => {
      const res = await cambiarEstadoRenta(rentaId, destino);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {destinos.map((d) => {
          const cancelar = d === "CANCELADA";
          return (
            <Button
              key={d}
              variant={cancelar ? "outline" : "default"}
              className={
                "h-11 flex-1 " +
                (cancelar ? "text-destructive" : "")
              }
              disabled={pending}
              onClick={() => ir(d)}
            >
              {ACCION_ESTADO[d]}
            </Button>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
