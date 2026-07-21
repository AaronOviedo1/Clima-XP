"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, PackageCheck, PackageOpen, Truck } from "lucide-react";
import type { DiaCalendario } from "@/lib/calendario";
import { ESTADO_RENTA_META } from "@/lib/rentas";
import { fechaDesdeInput, fechaLarga } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const DIAS_SEMANA = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

// Entregas y recolecciones programadas ese día (una renta puede contar en ambas
// si se entrega y recoge el mismo día).
function agenda(d: DiaCalendario) {
  return {
    entregas: d.rentas.filter((r) => r.entrega).length,
    recolecciones: d.rentas.filter((r) => r.recoleccion).length,
  };
}

export function CalendarioMes({
  dias,
  hoy,
}: {
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

  const abiertoAgenda = abierto ? agenda(abierto) : null;

  return (
    <>
      <div className="space-y-2">
        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-2">
          {DIAS_SEMANA.map((d, i) => (
            <div
              key={i}
              className="py-1 text-center text-[11.5px] font-extrabold tracking-wide text-[#94a3b8]"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Cuadrícula del mes */}
        <div className="grid grid-cols-7 gap-2">
          {celdas.map((d, i) => {
            if (!d) return <div key={`hueco-${i}`} className="min-h-[104px]" />;

            const esHoy = d.fecha === hoy;
            const { entregas, recolecciones } = agenda(d);
            const conActividad = entregas > 0 || recolecciones > 0;

            return (
              <button
                key={d.fecha}
                type="button"
                onClick={() => conActividad && setAbierto(d)}
                disabled={!conActividad}
                aria-label={`${d.dia}: ${entregas} entregas, ${recolecciones} recolecciones`}
                className={cn(
                  "flex min-h-[104px] flex-col gap-1.5 rounded-xl p-2 text-left transition",
                  conActividad
                    ? "cursor-pointer hover:brightness-[0.98]"
                    : "cursor-default",
                  esHoy
                    ? "border-2 border-primary bg-[#f5f9ff]"
                    : conActividad
                      ? "border border-[#eef2f8] bg-card shadow-[0_6px_16px_-14px_rgba(20,38,63,.7)]"
                      : "border border-[#eef2f8] bg-[#fbfcfe]",
                )}
              >
                <span
                  className={cn(
                    "text-[13px] font-extrabold tabular-nums",
                    esHoy
                      ? "text-primary"
                      : conActividad
                        ? "text-foreground"
                        : "text-[#b7c2d2]",
                  )}
                >
                  {d.dia}
                </span>

                <div className="flex flex-col gap-1">
                  {entregas > 0 && (
                    <span className="inline-flex items-center gap-1.5 self-start rounded-md bg-[#e2edfb] px-1.5 py-0.5 text-[11px] font-bold text-[#2b5a9c]">
                      <span className="size-1.5 rounded-full bg-primary" />
                      {entregas} {entregas === 1 ? "entrega" : "entregas"}
                    </span>
                  )}
                  {recolecciones > 0 && (
                    <span className="inline-flex items-center gap-1.5 self-start rounded-md bg-[#fdefe2] px-1.5 py-0.5 text-[11px] font-bold text-[#b45309]">
                      <span className="size-1.5 rounded-full bg-[#ea6a2e]" />
                      {recolecciones} recol.
                    </span>
                  )}
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
          {abierto && abiertoAgenda && (
            <>
              <DialogTitle className="pr-8 first-letter:uppercase">
                {fechaLarga(fechaDesdeInput(abierto.fecha))}
              </DialogTitle>

              {/* Resumen del día: entregas y recolecciones */}
              <div className="flex flex-wrap gap-2">
                {abiertoAgenda.entregas > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#e2edfb] px-2.5 py-1 text-xs font-bold text-[#2b5a9c]">
                    <Truck className="size-3.5" /> {abiertoAgenda.entregas}{" "}
                    {abiertoAgenda.entregas === 1 ? "entrega" : "entregas"}
                  </span>
                )}
                {abiertoAgenda.recolecciones > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#fdefe2] px-2.5 py-1 text-xs font-bold text-[#b45309]">
                    <PackageOpen className="size-3.5" /> {abiertoAgenda.recolecciones}{" "}
                    {abiertoAgenda.recolecciones === 1 ? "recolección" : "recolecciones"}
                  </span>
                )}
              </div>

              {abierto.rentas.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sin rentas ese día.
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
