import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  rentaInclude,
  totalesDeRenta,
  ESTADOS_RENTA,
  ESTADO_RENTA_META,
} from "@/lib/rentas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RentaListItem } from "@/components/renta-list-item";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RentasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; saldo?: string }>;
}) {
  const { estado, saldo } = await searchParams;
  const soloSaldo = saldo === "1";
  const estadoFiltro = ESTADOS_RENTA.includes(estado as never) ? estado : undefined;

  const where: Prisma.RentaWhereInput = estadoFiltro
    ? { estado: estadoFiltro as never }
    : {};

  let rentas = await prisma.renta.findMany({
    where,
    include: rentaInclude,
    orderBy: [{ fechaInicio: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  if (soloSaldo) {
    rentas = rentas.filter((r) => totalesDeRenta(r).saldo > 0);
  }

  const mkHref = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (params.estado) sp.set("estado", params.estado);
    if (params.saldo) sp.set("saldo", params.saldo);
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

      {/* Filtros de estado */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Link href={mkHref({ saldo })}>
          <Badge
            variant={!estadoFiltro ? "default" : "outline"}
            className={cn("cursor-pointer whitespace-nowrap px-3 py-1")}
          >
            Todas
          </Badge>
        </Link>
        {ESTADOS_RENTA.map((e) => (
          <Link key={e} href={mkHref({ estado: e, saldo })}>
            <Badge
              variant={estadoFiltro === e ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap px-3 py-1"
            >
              {ESTADO_RENTA_META[e].label}
            </Badge>
          </Link>
        ))}
      </div>

      <Link href={mkHref({ estado: estadoFiltro, saldo: soloSaldo ? undefined : "1" })}>
        <Badge
          variant={soloSaldo ? "default" : "outline"}
          className="cursor-pointer px-3 py-1"
        >
          Con saldo pendiente
        </Badge>
      </Link>

      {rentas.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin rentas para este filtro.
        </p>
      ) : (
        <ul className="space-y-2">
          {rentas.map((r) => (
            <li key={r.id}>
              <RentaListItem renta={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
