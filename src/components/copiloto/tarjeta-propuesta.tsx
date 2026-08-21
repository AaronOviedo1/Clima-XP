"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DialogoEntrega } from "@/components/dialogo-entrega";
import { DialogoRecoleccion } from "@/components/dialogo-recoleccion";
import type { PropuestaCliente } from "@/lib/copiloto/accion";

export type DecisionPropuesta = "confirmar" | "cancelar";

// Chip de estado de la propuesta, con los tokens del tema (nada de hex).
const CHIP: Record<PropuestaCliente["estado"], { texto: string; clase: string }> = {
  PROPUESTA: { texto: "Por confirmar", clase: "bg-chip-ambar text-chip-ambar-fg" },
  CONFIRMADA: { texto: "Ejecutando…", clase: "bg-chip-ambar text-chip-ambar-fg" },
  EJECUTADA: { texto: "Hecho", clase: "bg-chip-verde text-chip-verde-fg" },
  FALLIDA: { texto: "No se pudo", clase: "bg-chip-rojo text-chip-rojo-fg" },
  CANCELADA: { texto: "Cancelada", clase: "bg-muted text-muted-foreground" },
  EXPIRADA: { texto: "Vencida", clase: "bg-muted text-muted-foreground" },
};

/**
 * La tarjeta de una acción propuesta por el copiloto: qué se va a hacer, sobre
 * qué (líneas calculadas en el servidor) y los botones para decidir. Nada se
 * ejecuta hasta tocar Confirmar; después muestra en qué terminó.
 *
 * Para Entregado / Recogido, Confirmar abre los MISMOS diálogos de accesorios
 * de la app (qué se dejó / qué faltó): eso lo elige la persona, no el modelo,
 * y viaja como `datos` de la confirmación.
 */
export function TarjetaPropuesta({
  propuesta,
  minutosRestantes,
  ocupado,
  onDecidir,
  onNavegar,
}: {
  propuesta: PropuestaCliente;
  minutosRestantes: number | null; // solo mientras está por confirmar
  ocupado: boolean; // hay una decisión en vuelo
  onDecidir: (decision: DecisionPropuesta, datos?: unknown) => void | Promise<void>;
  onNavegar?: () => void; // al tocar "Ver renta" (cierra el panel en móvil)
}) {
  const p = propuesta;
  const viva = p.estado === "PROPUESTA";
  const chip = CHIP[p.estado] ?? CHIP.PROPUESTA;
  const [dialogo, setDialogo] = useState<"entrega" | "recoleccion" | null>(null);

  function confirmar() {
    if (p.confirmacion.tipo === "entrega") setDialogo("entrega");
    else if (p.confirmacion.tipo === "recoleccion") setDialogo("recoleccion");
    else void onDecidir("confirmar");
  }

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-linea bg-card text-card-foreground">
      <div className="flex items-start gap-2 px-3 pt-3">
        <p className="min-w-0 flex-1 text-[14px] leading-snug font-bold">{p.titulo}</p>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", chip.clase)}>
          {chip.texto}
        </span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 pt-2.5 text-[13px] leading-snug">
        {p.lineas.map((l, i) => (
          <Fragment key={`${l.etiqueta}-${i}`}>
            <dt className="text-tenue">{l.etiqueta}</dt>
            <dd className="min-w-0 break-words">{l.valor}</dd>
          </Fragment>
        ))}
      </dl>

      {!viva && p.resultado && (
        <p
          className={cn(
            "px-3 pt-2.5 text-[13px] leading-snug",
            p.estado === "FALLIDA"
              ? "text-destructive"
              : p.estado === "EJECUTADA"
                ? "text-chip-verde-fg"
                : "text-tenue",
          )}
        >
          {p.resultado}
        </p>
      )}

      {viva ? (
        <div className="px-3 pt-3 pb-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl"
              disabled={ocupado}
              onClick={() => onDecidir("cancelar")}
            >
              Cancelar
            </Button>
            <Button type="button" className="h-11 flex-1 rounded-xl" disabled={ocupado} onClick={confirmar}>
              {ocupado ? "Un momento…" : "Confirmar"}
            </Button>
          </div>
          {minutosRestantes !== null && (
            <p className="mt-2 text-[11px] text-tenue">
              Vence en {minutosRestantes} min si no se confirma.
            </p>
          )}
        </div>
      ) : (
        <div className="px-3 pt-2 pb-3">
          {p.enlace && p.estado === "EJECUTADA" && (
            <Link
              href={p.enlace}
              onClick={onNavegar}
              className="text-[13px] font-semibold text-primary underline-offset-2 hover:underline"
            >
              {p.enlace.startsWith("/inventario") ? "Ver inventario" : "Ver renta"}
            </Link>
          )}
        </div>
      )}

      {/* Los diálogos se cierran solos cuando la propuesta deja de estar viva
          (el servidor ya respondió), por eso `abierto` exige `viva`. */}
      {p.confirmacion.tipo === "entrega" && (
        <DialogoEntrega
          tiposEquipo={p.confirmacion.tiposEquipo}
          abierto={dialogo === "entrega" && viva}
          onOpenChange={(v) => setDialogo(v ? "entrega" : null)}
          onConfirmar={(accesorioIds) => void onDecidir("confirmar", { accesorioIds })}
          pending={ocupado}
        />
      )}
      {p.confirmacion.tipo === "recoleccion" && (
        <DialogoRecoleccion
          rentaId={p.confirmacion.rentaId}
          abierto={dialogo === "recoleccion" && viva}
          onOpenChange={(v) => setDialogo(v ? "recoleccion" : null)}
          onConfirmar={(noRecogidos) => void onDecidir("confirmar", { noRecogidos })}
          pending={ocupado}
        />
      )}
    </div>
  );
}
