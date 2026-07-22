import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  rentaListSelect,
  totalesDeRenta,
  equiposPorModelo,
  ESTADOS_RENTA,
  ESTADO_RENTA_META,
  ESTADO_CHIP,
} from "@/lib/rentas";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Buscador } from "@/components/buscador";
import { DIA_SEMANA_META, claseColorDia, colorBarraDia } from "@/lib/colores-dia";
import {
  claveSemana,
  diferenciaSemanas,
  fechaCorta,
  fechaDesdeInput,
  hoyNegocio,
  inicioSemana,
  rangoSemana,
} from "@/lib/fechas";
import { pesos } from "@/lib/dinero";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const GRID = "grid grid-cols-[14px_1.7fr_1.1fr_1fr_0.9fr_0.8fr] gap-3";

// Estados que cuentan como "activas" (renta en curso, aún en la calle o por salir).
const ESTADOS_ACTIVAS = ["CONFIRMADA", "EN_RUTA", "ENTREGADA"] as const;

// Etiqueta de día relativa a hoy ("Hoy", "Mañana", "Ayer") o fecha corta.
function etiquetaDiaRelativo(fecha: Date, hoy: Date): string {
  const dia = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
  const base = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const diff = Math.round((dia - base) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  return fechaCorta(fecha);
}

export default async function RentasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; saldo?: string; activas?: string; q?: string }>;
}) {
  const { estado, saldo, activas, q } = await searchParams;
  const soloSaldo = saldo === "1";
  const soloActivas = activas === "1";
  const estadoFiltro = ESTADOS_RENTA.includes(estado as never) ? estado : undefined;
  const busqueda = q?.trim() || undefined;

  const where: Prisma.RentaWhereInput = soloActivas
    ? { estado: { in: [...ESTADOS_ACTIVAS] } }
    : estadoFiltro
      ? { estado: estadoFiltro as never }
      : {};

  if (busqueda) {
    const digitos = busqueda.replace(/\D/g, "");
    where.OR = [
      { cliente: { nombre: { contains: busqueda, mode: "insensitive" } } },
      { direccion: { contains: busqueda, mode: "insensitive" } },
      { notas: { contains: busqueda, mode: "insensitive" } },
      { unidades: { some: { unidad: { codigo: { contains: busqueda, mode: "insensitive" } } } } },
      // Teléfono: comparar solo dígitos (se guarda en E.164, +52…).
      ...(digitos.length >= 4
        ? [{ cliente: { telefono: { contains: digitos } } } as const]
        : []),
    ];
  }

  let rentas = await prisma.renta.findMany({
    relationLoadStrategy: "join", // 1 solo round-trip a la BD remota
    where,
    select: rentaListSelect,
    orderBy: [{ fechaInicio: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  if (soloSaldo) {
    rentas = rentas.filter((r) => totalesDeRenta(r).saldo > 0);
  }

  // Agrupadas por semana (lunes–domingo) de la fecha de entrega. Las rentas ya
  // vienen ordenadas por fechaInicio desc, así que los grupos salen en ese orden.
  const hoy = fechaDesdeInput(hoyNegocio());
  const semanas: {
    clave: string;
    lunes: Date;
    offset: number;
    rentas: typeof rentas;
    total: number;
    saldo: number;
  }[] = [];

  for (const r of rentas) {
    const clave = claveSemana(r.fechaInicio);
    let grupo = semanas.at(-1);
    if (grupo?.clave !== clave) {
      grupo = {
        clave,
        lunes: inicioSemana(r.fechaInicio),
        offset: diferenciaSemanas(r.fechaInicio, hoy),
        rentas: [],
        total: 0,
        saldo: 0,
      };
      semanas.push(grupo);
    }
    const t = totalesDeRenta(r);
    grupo.rentas.push(r);
    grupo.total += t.total;
    grupo.saldo += t.saldo;
  }

  const tituloSemana = (offset: number) =>
    offset === 0
      ? "Esta semana"
      : offset === -1
        ? "Semana pasada"
        : offset === 1
          ? "Próxima semana"
          : null;

  const mkHref = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (params.estado) sp.set("estado", params.estado);
    if (params.saldo) sp.set("saldo", params.saldo);
    if (params.activas) sp.set("activas", params.activas);
    if (busqueda) sp.set("q", busqueda);
    const s = sp.toString();
    return s ? `/rentas?${s}` : "/rentas";
  };

  // Segmented control (móvil): Todas / Activas / Con saldo.
  const segmentos: { label: string; href: string; activo: boolean }[] = [
    { label: "Todas", href: mkHref({}), activo: !estadoFiltro && !soloSaldo && !soloActivas },
    { label: "Activas", href: mkHref({ activas: "1" }), activo: soloActivas },
    { label: "Con saldo", href: mkHref({ saldo: "1" }), activo: soloSaldo },
  ];

  // Chips de estado (diseño): Todas + estados principales + Con saldo.
  const chips: { label: string; href: string; activo: boolean }[] = [
    {
      label: "Todas",
      href: mkHref({}),
      activo: !estadoFiltro && !soloSaldo,
    },
    ...(["CONFIRMADA", "EN_RUTA", "ENTREGADA", "CONCLUIDA"] as const).map((e) => ({
      label: ESTADO_RENTA_META[e].label,
      href: mkHref({ estado: e }),
      activo: estadoFiltro === e,
    })),
    {
      label: "Con saldo",
      href: mkHref({ estado: estadoFiltro, saldo: "1" }),
      activo: soloSaldo,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header solo móvil (en desktop lo cubre el TopBar). */}
      <div className="flex items-center justify-between gap-2 lg:hidden">
        <h1 className="text-[34px] leading-[1.05] font-extrabold tracking-[-0.02em]">Rentas</h1>
        <Link
          href="/rentas/nueva"
          aria-label="Nueva renta"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_18px_-8px_var(--primary)] transition-transform active:scale-90"
        >
          <Plus className="size-5" />
        </Link>
      </div>
      <div className="lg:hidden">
        <Buscador placeholder="Buscar por cliente, teléfono, dirección o equipo…" />
      </div>

      {/* Segmented control (móvil). */}
      <div className="flex gap-1 rounded-xl bg-muted p-1 lg:hidden">
        {segmentos.map((seg) => (
          <Link
            key={seg.label}
            href={seg.href}
            className={cn(
              "flex h-9 flex-1 items-center justify-center rounded-[9px] text-[13.5px] font-bold transition-colors",
              seg.activo ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {seg.label}
          </Link>
        ))}
      </div>

      {/* Controles desktop: chips de estado + leyenda de días. */}
      <div className="hidden flex-wrap items-center gap-2 lg:flex">
        {chips.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={cn(
              "flex h-9 items-center rounded-[10px] px-4 text-[13px] font-bold transition-colors",
              c.activo
                ? "bg-primary text-primary-foreground"
                : "border border-input bg-card text-medio hover:border-primary/40 hover:text-foreground",
            )}
          >
            {c.label}
          </Link>
        ))}
        <div className="flex-1" />
        <div className="hidden items-center gap-1.5 text-xs font-semibold text-tenue sm:flex">
          <span>Entrega:</span>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <span
              key={d}
              title={DIA_SEMANA_META[d].nombre}
              className={cn(
                "flex size-[22px] items-center justify-center rounded-md border border-black/5 text-[11px] font-extrabold text-[#3a4658] dark:border-white/10 dark:text-foreground",
                DIA_SEMANA_META[d].clase,
              )}
            >
              {DIA_SEMANA_META[d].letra}
            </span>
          ))}
        </div>
      </div>

      {rentas.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {busqueda ? `Sin resultados para “${busqueda}”.` : "Sin rentas para este filtro."}
        </p>
      ) : (
        <>
          {/* Tabla por semana (desktop). */}
          <Card className="hidden overflow-hidden py-0 lg:block">
            {/* Encabezados de columna, una sola vez arriba de la tabla. */}
            <div
              className={cn(
                GRID,
                "border-b border-linea px-5 py-2.5 text-[11.5px] font-bold tracking-wide text-tenue uppercase",
              )}
            >
              <span />
              <span>Cliente</span>
              <span>Equipos</span>
              <span>Fechas</span>
              <span>Estado</span>
              <span className="text-right">Total</span>
            </div>
            {semanas.map((s) => {
              const titulo = tituloSemana(s.offset);
              const actual = s.offset === 0;
              return (
                <details
                  key={s.clave}
                  open={actual}
                  className="group border-t border-linea first:border-t-0"
                >
                  <summary
                    className={cn(
                      "flex list-none cursor-pointer items-center justify-between gap-3 px-5 py-3.5 select-none [&::-webkit-details-marker]:hidden",
                      actual
                        ? "bg-superficie-activa"
                        : "bg-superficie-suave hover:bg-superficie-hover",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <ChevronRight className="size-4 text-tenue transition-transform group-open:rotate-90" />
                      <span
                        className={cn(
                          "text-sm font-extrabold",
                          actual ? "text-primary" : "text-foreground",
                        )}
                      >
                        {titulo ?? rangoSemana(s.lunes)}
                      </span>
                      {titulo && (
                        <span className="text-[12.5px] text-tenue">
                          {rangoSemana(s.lunes)}
                        </span>
                      )}
                    </div>
                    <div className="text-[12.5px] font-semibold text-muted-foreground">
                      {s.rentas.length} rentas ·{" "}
                      <span className="font-extrabold text-foreground">
                        {pesos(s.total)}
                      </span>
                      {s.saldo > 0 && (
                        <span className="font-bold text-saldo">
                          {" "}
                          · deben {pesos(s.saldo)}
                        </span>
                      )}
                    </div>
                  </summary>
                  {s.rentas.map((r) => {
                    const t = totalesDeRenta(r);
                    const meta = ESTADO_RENTA_META[r.estado];
                    const equipos = equiposPorModelo(r.unidades);
                    return (
                      <Link
                        key={r.id}
                        href={`/rentas/${r.id}`}
                        className={cn(
                          GRID,
                          "items-center border-b border-linea-suave px-5 py-3.5 transition hover:brightness-[0.965] dark:hover:brightness-125",
                          claseColorDia(r.fechaInicio),
                        )}
                      >
                        <span
                          className={cn(
                            "h-9 w-2 rounded",
                            claseColorDia(r.fechaInicio),
                          )}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold">
                            {r.cliente.nombre}
                          </div>
                          <div className="truncate text-xs text-tenue">
                            {r.direccion}
                          </div>
                        </div>
                        <div className="text-[13px] font-semibold text-medio">
                          {equipos.length === 0
                            ? "Sin equipos"
                            : equipos
                                .map((e) => `${e.cantidad} × ${e.nombre}`)
                                .join(" · ")}
                        </div>
                        <div className="text-[12.5px] text-muted-foreground tabular-nums">
                          {fechaCorta(r.fechaInicio)} → {fechaCorta(r.fechaFin)}
                        </div>
                        <div>
                          <Badge variant={meta.badge}>{meta.label}</Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold tabular-nums">
                            {pesos(t.total)}
                          </div>
                          {t.saldo > 0 && (
                            <div className="text-[11.5px] font-bold text-saldo">
                              Debe {pesos(t.saldo)}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </details>
              );
            })}
          </Card>

          {/* Grupos por semana colapsables (móvil). */}
          <div className="space-y-4 lg:hidden">
            {semanas.map((s) => {
              const titulo = tituloSemana(s.offset) ?? rangoSemana(s.lunes);
              return (
                <details key={s.clave} open={s.offset === 0} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-1 py-1.5">
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                    <span className="text-[12.5px] font-extrabold tracking-wide text-muted-foreground uppercase">
                      {titulo}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-bold text-muted-foreground">
                      {s.rentas.length}
                    </span>
                    <span className="flex-1" />
                    <span className="text-[12.5px] font-bold text-foreground/80 tabular-nums">
                      {pesos(s.total)}
                    </span>
                  </summary>
                  <Card className="mt-1.5 gap-0 overflow-hidden py-0">
                    {s.rentas.map((r) => {
                      const t = totalesDeRenta(r);
                      const meta = ESTADO_RENTA_META[r.estado];
                      const equipos = equiposPorModelo(r.unidades);
                      const equiposStr =
                        equipos.length === 0
                          ? "Sin equipos"
                          : equipos.map((e) => `${e.cantidad} × ${e.nombre}`).join(" · ");
                      return (
                        <Link
                          key={r.id}
                          href={`/rentas/${r.id}`}
                          className={cn(
                            "flex items-center gap-3 border-b px-[15px] py-3 last:border-b-0 active:brightness-95",
                            claseColorDia(r.fechaInicio),
                          )}
                        >
                          <span
                            className="h-[42px] w-1.5 shrink-0 rounded"
                            style={{ background: colorBarraDia(r.fechaInicio) }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[15.5px] font-bold tracking-[-0.3px]">
                                {r.cliente.nombre}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-extrabold tracking-wide uppercase",
                                  ESTADO_CHIP[r.estado] ?? "bg-muted text-muted-foreground",
                                )}
                              >
                                {meta.label}
                              </span>
                            </div>
                            <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                              {etiquetaDiaRelativo(r.fechaInicio, hoy)} · {equiposStr}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-[15px] font-extrabold tracking-[-0.3px] tabular-nums">
                              {pesos(t.total)}
                            </div>
                            {t.saldo > 0 && (
                              <div className="text-[11.5px] font-bold text-amber-600 tabular-nums dark:text-amber-500">
                                Debe {pesos(t.saldo)}
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </Card>
                </details>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
