import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rentaListSelect, totalesDeRenta, ESTADOS_RENTA } from "@/lib/rentas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RentaListItem } from "@/components/renta-list-item";
import { Buscador } from "@/components/buscador";
import { RentaFiltroEstado } from "@/components/renta-filtro-estado";
import { DIA_SEMANA_META } from "@/lib/colores-dia";
import {
  claveSemana,
  diferenciaSemanas,
  fechaDesdeInput,
  hoyNegocio,
  inicioSemana,
  rangoSemana,
} from "@/lib/fechas";
import { pesos } from "@/lib/dinero";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Rentas</h1>
        <Button asChild size="sm">
          <Link href="/rentas/nueva">
            <Plus className="size-4" /> Nueva
          </Link>
        </Button>
      </div>

      <Buscador placeholder="Buscar por cliente, teléfono, dirección o equipo…" />

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <RentaFiltroEstado estado={estadoFiltro} />
        </div>
        <Link href={mkHref({ estado: estadoFiltro, saldo: soloSaldo ? undefined : "1" })}>
          <Badge
            variant={soloSaldo ? "default" : "outline"}
            className="h-11 cursor-pointer whitespace-nowrap px-3"
          >
            Con saldo pendiente
          </Badge>
        </Link>
      </div>

      {/* Leyenda: color por día de entrega (como en el Excel) */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>Entrega:</span>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <span
            key={d}
            title={DIA_SEMANA_META[d].nombre}
            className={cn(
              "rounded border px-1.5 py-0.5 font-medium text-foreground",
              DIA_SEMANA_META[d].clase
            )}
          >
            {DIA_SEMANA_META[d].letra}
          </span>
        ))}
      </div>

      {rentas.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {busqueda ? `Sin resultados para “${busqueda}”.` : "Sin rentas para este filtro."}
        </p>
      ) : (
        <div className="space-y-6">
          {semanas.map((s) => {
            const titulo = tituloSemana(s.offset);
            return (
              <section key={s.clave} className="space-y-2">
                <div
                  className={cn(
                    "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b pb-1.5",
                    s.offset === 0 && "border-primary/60"
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
      )}
    </div>
  );
}
