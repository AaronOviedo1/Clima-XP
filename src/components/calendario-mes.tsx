"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, PackageCheck, PackageOpen, Truck } from "lucide-react";
import type { DiaCalendario, ModeloCalendario } from "@/lib/calendario";
import { ESTADO_RENTA_META } from "@/lib/rentas";
import { fechaDesdeInput, fechaLarga } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

// Chip con las unidades libres de un modelo: rojo si no queda ninguna, ámbar si
// hay ocupación parcial, y sin fondo cuando está todo libre (para que un día
// tranquilo se vea tranquilo).
function claseChip(libres: number, total: number): string {
  if (libres === 0) return "bg-red-500/15 font-bold text-red-700 dark:text-red-400";
  if (libres < total)
    return "bg-amber-500/15 font-semibold text-amber-700 dark:text-amber-500";
  return "text-muted-foreground/60";
}

export function CalendarioMes({
  modelos,
  dias,
  hoy,
}: {
  modelos: ModeloCalendario[];
  dias: DiaCalendario[];
  hoy: string;
}) {
  const [abierto, setAbierto] = useState<DiaCalendario | null>(null);

  // Huecos al inicio para que el día 1 caiga bajo su día de la semana (lunes = 0)
  // y al final para completar la última semana: la cuadrícula siempre cierra en
  // múltiplos de 7.
  const primero = fechaDesdeInput(dias[0].fecha);
  const huecoInicial = (primero.getUTCDay() + 6) % 7;
  const celdas: (DiaCalendario | null)[] = [
    ...Array<null>(huecoInicial).fill(null),
    ...dias,
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  return (
    <>
      <div className="space-y-1">
        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1">
          {DIAS_SEMANA.map((d, i) => (
            <div
              key={i}
              className="pb-1 text-center text-xs font-semibold text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Cuadrícula del mes */}
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((d, i) => {
            if (!d) return <div key={`hueco-${i}`} />;

            const esHoy = d.fecha === hoy;
            const esPasado = d.fecha < hoy;
            const agotado = modelos.some((m) => d.libresPorModelo[m.id] === 0);

            return (
              <button
                key={d.fecha}
                type="button"
                onClick={() => setAbierto(d)}
                aria-label={`${d.dia}: ${d.rentas.length} rentas`}
                className={cn(
                  "flex min-h-[4.75rem] flex-col gap-1 rounded-lg border bg-card p-1.5 text-left transition",
                  "hover:border-primary/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  agotado && "border-red-500/30 bg-red-500/[0.04]",
                  esPasado && "opacity-50",
                  esHoy && "border-primary ring-1 ring-primary",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      esHoy &&
                        "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                    )}
                  >
                    {d.dia}
                  </span>
                  {d.rentas.length > 0 && (
                    <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                      {d.rentas.length}
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  {modelos.map((m) => {
                    const libres = d.libresPorModelo[m.id];
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-0.5 text-[10px] leading-tight"
                      >
                        <span className="text-muted-foreground/70">{m.abrev}</span>
                        <span
                          className={cn(
                            "min-w-4 rounded px-1 text-center tabular-nums",
                            claseChip(libres, m.total),
                          )}
                        >
                          {libres}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={abierto !== null} onOpenChange={(o) => !o && setAbierto(null)}>
        <DialogContent
          aria-describedby={undefined}
          overlayClassName="backdrop-blur-md bg-black/30"
          className="no-scrollbar max-h-[85dvh] overflow-y-auto overflow-x-hidden sm:max-w-lg"
        >
          {abierto && (
            <>
              <DialogTitle className="pr-8 first-letter:uppercase">
                {fechaLarga(fechaDesdeInput(abierto.fecha))}
              </DialogTitle>

              {/* Disponibilidad del día */}
              <div className="flex flex-wrap gap-1.5">
                {modelos.map((m) => {
                  const libres = abierto.libresPorModelo[m.id];
                  return (
                    <span
                      key={m.id}
                      className={cn(
                        "rounded-md px-2 py-1 text-xs",
                        libres === 0
                          ? "bg-red-500/15 font-semibold text-red-700 dark:text-red-400"
                          : libres < m.total
                            ? "bg-amber-500/15 font-medium text-amber-700 dark:text-amber-500"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {m.nombre}: {libres} de {m.total} libres
                    </span>
                  );
                })}
              </div>

              {abierto.rentas.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sin rentas ese día. Todo el equipo está libre.
                </p>
              ) : (
                <ul className="space-y-2">
                  {abierto.rentas.map((r) => {
                    const meta = ESTADO_RENTA_META[r.estado];
                    return (
                      <li key={r.id}>
                        <Link
                          href={`/rentas/${r.id}`}
                          onClick={() => setAbierto(null)}
                          className="flex items-center gap-2 rounded-lg border p-2.5 transition hover:border-primary/60 hover:bg-accent"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-medium">
                                {r.cliente}
                              </span>
                              {meta && <Badge variant={meta.badge}>{meta.label}</Badge>}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {r.equipos
                                .map((e) => `${e.cantidad} × ${e.nombre}`)
                                .join(" · ")}
                            </p>
                            <p className="flex items-center gap-1 text-xs">
                              {r.entrega && r.recoleccion ? (
                                <span className="flex items-center gap-1 font-medium text-primary">
                                  <Truck className="size-3.5" /> Entrega y recolección
                                </span>
                              ) : r.entrega ? (
                                <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                                  <PackageCheck className="size-3.5" /> Entrega
                                </span>
                              ) : r.recoleccion ? (
                                <span className="flex items-center gap-1 font-medium text-sky-700 dark:text-sky-400">
                                  <PackageOpen className="size-3.5" /> Recolección
                                </span>
                              ) : (
                                <span className="text-muted-foreground">En curso</span>
                              )}
                            </p>
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
