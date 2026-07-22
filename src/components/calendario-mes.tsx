"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, PackageCheck, PackageOpen, Truck } from "lucide-react";
import type {
  DiaCalendario,
  ModeloCalendario,
  RentaDia,
} from "@/lib/calendario";
import { ESTADO_RENTA_META } from "@/lib/rentas";
import { fechaDesdeInput, fechaLarga } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

// Entregas y recolecciones programadas ese día (una renta puede contar en ambas
// si se entrega y recoge el mismo día).
function agenda(d: DiaCalendario) {
  return {
    entregas: d.rentas.filter((r) => r.entrega).length,
    recolecciones: d.rentas.filter((r) => r.recoleccion).length,
  };
}

// Ocupación del día: agotado si algún modelo se queda sin unidades libres,
// parcial si hay ocupación sin agotar, libre si todo el equipo está disponible.
type Ocupacion = "libre" | "parcial" | "agotado";
function ocupacionDia(d: DiaCalendario, modelos: ModeloCalendario[]): Ocupacion {
  let agotado = false;
  let parcial = false;
  for (const m of modelos) {
    const libres = d.libresPorModelo[m.id] ?? m.total;
    if (libres <= 0) agotado = true;
    else if (libres < m.total) parcial = true;
  }
  return agotado ? "agotado" : parcial ? "parcial" : "libre";
}

function equipoStr(r: RentaDia): string {
  if (r.equipos.length === 0) return "Sin equipos";
  if (r.equipos.length === 1)
    return `${r.equipos[0].cantidad} × ${r.equipos[0].nombre}`;
  const total = r.equipos.reduce((a, e) => a + e.cantidad, 0);
  return `${total} equipos`;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS_NOMBRE = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];

// Encabezado "HOY, 20 DE JULIO" / "MARTES, 22 DE JULIO".
function tituloDia(fecha: string, hoy: string): string {
  const dt = fechaDesdeInput(fecha);
  const cola = `${dt.getUTCDate()} de ${MESES[dt.getUTCMonth()]}`;
  return (
    fecha === hoy ? `Hoy, ${cola}` : `${DIAS_NOMBRE[dt.getUTCDay()]}, ${cola}`
  ).toUpperCase();
}

function celdas(dias: DiaCalendario[]): (DiaCalendario | null)[] {
  const primero = fechaDesdeInput(dias[0].fecha);
  const huecoInicial = (primero.getUTCDay() + 6) % 7;
  const arr: (DiaCalendario | null)[] = [
    ...Array<null>(huecoInicial).fill(null),
    ...dias,
  ];
  while (arr.length % 7 !== 0) arr.push(null);
  return arr;
}

// Etiqueta ENTREGA / RECOLECCIÓN / EN CURSO de una renta ese día.
function EtiquetaEvento({ r }: { r: RentaDia }) {
  if (r.entrega)
    return (
      <span className="shrink-0 rounded-md bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] px-2 py-1 text-[10.5px] font-extrabold tracking-wide text-primary uppercase">
        Entrega
      </span>
    );
  if (r.recoleccion)
    return (
      <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-1 text-[10.5px] font-extrabold tracking-wide text-amber-600 uppercase dark:text-amber-500">
        Recolección
      </span>
    );
  return (
    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[10.5px] font-extrabold tracking-wide text-muted-foreground uppercase">
      En curso
    </span>
  );
}

export function CalendarioMes({
  dias,
  modelos,
  hoy,
}: {
  dias: DiaCalendario[];
  modelos: ModeloCalendario[];
  hoy: string;
}) {
  // Desktop: día abierto en diálogo. Móvil: día seleccionado para la lista.
  const [abierto, setAbierto] = useState<DiaCalendario | null>(null);
  const hoyDia = dias.find((d) => d.fecha === hoy) ?? null;
  const [selFecha, setSelFecha] = useState<string | null>(hoyDia?.fecha ?? null);
  const sel = dias.find((d) => d.fecha === selFecha) ?? hoyDia;

  const grid = celdas(dias);
  const abiertoAgenda = abierto ? agenda(abierto) : null;

  return (
    <>
      {/* ===================== MÓVIL: ocupación + lista del día ===================== */}
      <div className="space-y-4 lg:hidden">
        <Card className="gap-0 py-3.5">
          <div className="grid grid-cols-7">
            {DIAS_SEMANA.map((d, i) => (
              <div
                key={i}
                className="pb-2 text-center text-[11px] font-extrabold text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1.5">
            {grid.map((d, i) => {
              if (!d) return <div key={`h-${i}`} className="h-11" />;
              const esHoy = d.fecha === hoy;
              const ocup = ocupacionDia(d, modelos);
              const conRentas = d.rentas.length > 0;
              return (
                <div key={d.fecha} className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => conRentas && setSelFecha(d.fecha)}
                    disabled={!conRentas}
                    aria-label={`${d.dia}`}
                    className={cn(
                      "flex size-11 flex-col items-center justify-center gap-1 rounded-xl transition active:scale-95",
                      ocup === "parcial" && "bg-amber-400/25",
                      ocup === "agotado" && "bg-red-400/25",
                      esHoy && "ring-2 ring-primary",
                      d.fecha === selFecha && !esHoy && "ring-2 ring-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[14px] font-bold tabular-nums",
                        ocup === "libre" && !esHoy
                          ? "text-muted-foreground"
                          : "text-foreground",
                        esHoy && "text-primary",
                      )}
                    >
                      {d.dia}
                    </span>
                    {conRentas && (
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          ocup === "agotado" ? "bg-red-500" : "bg-amber-500",
                        )}
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Leyenda */}
        <div className="flex gap-4 px-1">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
            <span className="size-3 rounded bg-amber-400/60" /> Ocupación parcial
          </span>
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
            <span className="size-3 rounded bg-red-400/50" /> Agotado
          </span>
        </div>

        {/* Eventos del día seleccionado */}
        {sel && (
          <div>
            <div className="mb-2.5 px-1 text-[12.5px] font-extrabold tracking-wide text-muted-foreground">
              {tituloDia(sel.fecha, hoy)}
            </div>
            {sel.rentas.length === 0 ? (
              <Card className="py-0">
                <p className="px-4 py-5 text-center text-sm text-muted-foreground">
                  Sin entregas ni recolecciones ese día.
                </p>
              </Card>
            ) : (
              <Card className="gap-0 py-0">
                {sel.rentas.map((r) => (
                  <Link
                    key={r.id}
                    href={`/rentas/${r.id}`}
                    className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 active:bg-muted"
                  >
                    <EtiquetaEvento r={r} />
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">
                      {r.cliente}
                    </span>
                    <span className="shrink-0 text-[12.5px] font-semibold text-muted-foreground">
                      {equipoStr(r)}
                    </span>
                  </Link>
                ))}
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ===================== DESKTOP: badges por día + diálogo ===================== */}
      <Card className="hidden py-0 lg:block">
        <div className="space-y-2 p-3.5">
          <div className="grid grid-cols-7 gap-2">
            {["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"].map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[11.5px] font-extrabold tracking-wide text-tenue"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {grid.map((d, i) => {
              if (!d) return <div key={`hd-${i}`} className="min-h-[104px]" />;
              const esHoy = d.fecha === hoy;
              const { entregas, recolecciones } = agenda(d);
              const conActividad = entregas > 0 || recolecciones > 0;
              return (
                <button
                  key={d.fecha}
                  type="button"
                  onClick={() => conActividad && setAbierto(d)}
                  disabled={!conActividad}
                  className={cn(
                    "flex min-h-[104px] flex-col gap-1.5 rounded-xl p-2 text-left transition",
                    conActividad
                      ? "cursor-pointer hover:brightness-[0.98] dark:hover:brightness-125"
                      : "cursor-default",
                    esHoy
                      ? "border-2 border-primary bg-primary/5"
                      : conActividad
                        ? "border border-border bg-card shadow-[0_6px_16px_-14px_rgba(20,38,63,.7)]"
                        : "border border-border bg-muted/30",
                  )}
                >
                  <span
                    className={cn(
                      "text-[13px] font-extrabold tabular-nums",
                      esHoy ? "text-primary" : conActividad ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {d.dia}
                  </span>
                  <div className="flex flex-col gap-1">
                    {entregas > 0 && (
                      <span className="inline-flex items-center gap-1.5 self-start rounded-md bg-chip-azul px-1.5 py-0.5 text-[11px] font-bold text-chip-azul-fg">
                        <span className="size-1.5 rounded-full bg-primary" />
                        {entregas} {entregas === 1 ? "entrega" : "entregas"}
                      </span>
                    )}
                    {recolecciones > 0 && (
                      <span className="inline-flex items-center gap-1.5 self-start rounded-md bg-chip-ambar px-1.5 py-0.5 text-[11px] font-bold text-chip-ambar-fg">
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
      </Card>

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

              <div className="flex flex-wrap gap-2">
                {abiertoAgenda.entregas > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-chip-azul px-2.5 py-1 text-xs font-bold text-chip-azul-fg">
                    <Truck className="size-3.5" /> {abiertoAgenda.entregas}{" "}
                    {abiertoAgenda.entregas === 1 ? "entrega" : "entregas"}
                  </span>
                )}
                {abiertoAgenda.recolecciones > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-chip-ambar px-2.5 py-1 text-xs font-bold text-chip-ambar-fg">
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
