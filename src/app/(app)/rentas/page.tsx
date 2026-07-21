import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  rentaListSelect,
  totalesDeRenta,
  equiposPorModelo,
  ESTADOS_RENTA,
  ESTADO_RENTA_META,
} from "@/lib/rentas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RentaListItem } from "@/components/renta-list-item";
import { Buscador } from "@/components/buscador";
import { DIA_SEMANA_META, claseColorDia } from "@/lib/colores-dia";
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

export default async function RentasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; saldo?: string; q?: string }>;
}) {
  const { estado, saldo, q } = await searchParams;
  const soloSaldo = saldo === "1";
  const estadoFiltro = ESTADOS_RENTA.includes(estado as never) ? estado : undefined;
  const busqueda = q?.trim() || undefined;

  const where: Prisma.RentaWhereInput = estadoFiltro
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
    if (busqueda) sp.set("q", busqueda);
    const s = sp.toString();
    return s ? `/rentas?${s}` : "/rentas";
  };

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
        <h1 className="text-2xl font-bold tracking-tight">Rentas</h1>
        <Button asChild size="sm">
          <Link href="/rentas/nueva">
            <Plus className="size-4" /> Nueva
          </Link>
        </Button>
      </div>
      <div className="lg:hidden">
        <Buscador placeholder="Buscar por cliente, teléfono, dirección o equipo…" />
      </div>

      {/* Controles: chips de estado + leyenda de días. */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={cn(
              "flex h-9 items-center rounded-[10px] px-4 text-[13px] font-bold transition-colors",
              c.activo
                ? "bg-primary text-primary-foreground"
                : "border border-[#e0e8f3] bg-white text-[#5a6b82] hover:border-[#b9c9df]",
            )}
          >
            {c.label}
          </Link>
        ))}
        <div className="flex-1" />
        <div className="hidden items-center gap-1.5 text-xs font-semibold text-[#94a3b8] sm:flex">
          <span>Entrega:</span>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <span
              key={d}
              title={DIA_SEMANA_META[d].nombre}
              className={cn(
                "flex size-[22px] items-center justify-center rounded-md border border-black/5 text-[11px] font-extrabold text-[#3a4658]",
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
            {semanas.map((s) => {
              const titulo = tituloSemana(s.offset);
              const actual = s.offset === 0;
              return (
                <div key={s.clave}>
                  <div
                    className={cn(
                      "flex items-baseline justify-between gap-3 border-t border-[#eef2f8] px-5 py-3.5 first:border-t-0",
                      actual ? "bg-[#eef4fb]" : "bg-[#fafbfe]",
                    )}
                  >
                    <div className="flex items-baseline gap-2.5">
                      <span
                        className={cn(
                          "text-sm font-extrabold",
                          actual ? "text-primary" : "text-foreground",
                        )}
                      >
                        {titulo ?? rangoSemana(s.lunes)}
                      </span>
                      {titulo && (
                        <span className="text-[12.5px] text-[#94a3b8]">
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
                        <span className="font-bold text-[#d97706]">
                          {" "}
                          · deben {pesos(s.saldo)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={cn(
                      GRID,
                      "border-b border-[#eef2f8] px-5 py-2 text-[11.5px] font-bold tracking-wide text-[#94a3b8] uppercase",
                    )}
                  >
                    <span />
                    <span>Cliente</span>
                    <span>Equipos</span>
                    <span>Fechas</span>
                    <span>Estado</span>
                    <span className="text-right">Total</span>
                  </div>
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
                          "items-center border-b border-[#f4f7fc] px-5 py-3.5 transition hover:brightness-[0.965]",
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
                          <div className="truncate text-xs text-[#94a3b8]">
                            {r.direccion}
                          </div>
                        </div>
                        <div className="text-[13px] font-semibold text-[#5a6b82]">
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
                            <div className="text-[11.5px] font-bold text-[#d97706]">
                              Debe {pesos(t.saldo)}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </Card>

          {/* Tarjetas apiladas (móvil). */}
          <div className="space-y-6 lg:hidden">
            {semanas.map((s) => {
              const titulo = tituloSemana(s.offset);
              return (
                <section key={s.clave} className="space-y-2">
                  <div
                    className={cn(
                      "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b pb-1.5",
                      s.offset === 0 && "border-primary/60",
                    )}
                  >
                    <h2 className="flex items-baseline gap-2 text-sm font-semibold">
                      <span className={cn(s.offset === 0 && "text-primary")}>
                        {titulo ?? rangoSemana(s.lunes)}
                      </span>
                      {titulo && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {rangoSemana(s.lunes)}
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {s.rentas.length}{" "}
                      {s.rentas.length === 1 ? "renta" : "rentas"} · {pesos(s.total)}
                      {s.saldo > 0 && (
                        <span className="font-medium text-amber-600 dark:text-amber-500">
                          {" "}
                          · deben {pesos(s.saldo)}
                        </span>
                      )}
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {s.rentas.map((r) => (
                      <li key={r.id}>
                        <RentaListItem renta={r} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
