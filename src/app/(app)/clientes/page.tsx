import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { normalizarTelefono, formatoTelefono } from "@/lib/telefono";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Paleta de avatares por iniciales (diseño desktop).
const AV_PALETTE: [string, string][] = [
  ["#e2edfb", "#2b5a9c"],
  ["#fef3d6", "#b45309"],
  ["#e7f6ec", "#1c8a4b"],
  ["#fde9e5", "#c0392b"],
  ["#dff0fb", "#1f6fb0"],
];

function iniciales(nombre: string) {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

const CLI_GRID = "grid grid-cols-[2fr_1.3fr_1fr_0.8fr] gap-3";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const busqueda = q?.trim();

  const telefonoNorm = busqueda ? normalizarTelefono(busqueda) : null;
  const clientes = await prisma.cliente.findMany({
    where: busqueda
      ? {
          OR: [
            { nombre: { contains: busqueda, mode: "insensitive" } },
            { telefono: { contains: telefonoNorm ?? busqueda } },
          ],
        }
      : undefined,
    include: { _count: { select: { rentas: true } } },
    orderBy: { nombre: "asc" },
    take: 100,
  });

  return (
    <div className="space-y-5">
      {/* Header solo móvil (en desktop lo cubre el TopBar). */}
      <div className="flex items-center justify-between gap-2 lg:hidden">
        <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em]">Clientes</h1>
        <Button asChild size="sm">
          <Link href="/clientes/nuevo">
            <Plus className="size-4" /> Nuevo
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <form className="relative flex-1 lg:hidden">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={busqueda}
            placeholder="Buscar por nombre o teléfono"
            className="h-11 pl-9"
          />
        </form>
        <Button asChild size="sm" className="hidden lg:flex">
          <Link href="/clientes/nuevo">
            <Plus className="size-4" /> Nuevo cliente
          </Link>
        </Button>
      </div>

      {clientes.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {busqueda ? "Sin resultados." : "Aún no hay clientes."}
        </p>
      ) : (
        <>
          {/* Tabla (desktop). */}
          <Card className="hidden overflow-hidden py-0 lg:block">
            <div
              className={cn(
                CLI_GRID,
                "border-b border-[#eef2f8] bg-[#fafbfe] px-[22px] py-3.5 text-[11.5px] font-bold tracking-wide text-[#94a3b8] uppercase",
              )}
            >
              <span>Cliente</span>
              <span>Teléfono</span>
              <span>Origen</span>
              <span className="text-right">Rentas</span>
            </div>
            {clientes.map((c, i) => {
              const [bg, fg] = AV_PALETTE[i % AV_PALETTE.length];
              return (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  className={cn(
                    CLI_GRID,
                    "items-center border-b border-[#f4f7fc] px-[22px] py-3.5 hover:bg-[#f8fafd]",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex size-[38px] shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                      style={{ background: bg, color: fg }}
                    >
                      {iniciales(c.nombre)}
                    </div>
                    <span className="truncate font-bold">{c.nombre}</span>
                  </div>
                  <span className="text-[13.5px] text-[#5a6b82] tabular-nums">
                    {formatoTelefono(c.telefono) || "—"}
                  </span>
                  <span>
                    <span className="rounded-full bg-[#eef4fb] px-2.5 py-1 text-xs font-bold text-primary">
                      {c.canalOrigen}
                    </span>
                  </span>
                  <span className="text-right text-sm font-extrabold">
                    {c._count.rentas}
                  </span>
                </Link>
              );
            })}
          </Card>

          {/* Tarjetas (móvil). */}
          <ul className="space-y-2 lg:hidden">
            {clientes.map((c, i) => {
              const [bg, fg] = AV_PALETTE[i % AV_PALETTE.length];
              return (
                <li key={c.id}>
                  <Link href={`/clientes/${c.id}`}>
                    <Card className="transition-colors hover:bg-muted/50">
                      <CardContent className="flex items-center gap-3 py-3">
                        <div
                          className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                          style={{ background: bg, color: fg }}
                        >
                          {iniciales(c.nombre)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{c.nombre}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {formatoTelefono(c.telefono) || "Sin teléfono"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="secondary">{c.canalOrigen}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {c._count.rentas}{" "}
                            {c._count.rentas === 1 ? "renta" : "rentas"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
