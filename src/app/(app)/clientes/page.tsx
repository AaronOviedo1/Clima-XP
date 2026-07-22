import Link from "next/link";
import { Plus, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { normalizarTelefono, formatoTelefono, linkWhatsApp } from "@/lib/telefono";
import { Button } from "@/components/ui/button";
import { Buscador } from "@/components/buscador";
import { Card } from "@/components/ui/card";
import { DistintivoEquipos } from "@/components/distintivo-equipos";
import { tiposDeEquipoDeRentas } from "@/lib/rentas";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Paleta de avatares por iniciales (diseño desktop). Tokens, no hex: cada par
// tiene su versión oscura en globals.css.
const AV_PALETTE: [string, string][] = [
  ["var(--chip-azul)", "var(--chip-azul-fg)"],
  ["var(--chip-ambar)", "var(--chip-ambar-fg)"],
  ["var(--chip-verde)", "var(--chip-verde-fg)"],
  ["var(--chip-rojo)", "var(--chip-rojo-fg)"],
  ["var(--chip-cielo)", "var(--chip-cielo-fg)"],
];

function iniciales(nombre: string) {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      // Array.from respeta code points completos: `w[0]` partía los emojis
      // (pares de sustitución UTF-16) dejando medio carácter, lo que provocaba
      // un desajuste de hidratación en nombres que empiezan con emoji.
      .map((w) => Array.from(w)[0] ?? "")
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
    relationLoadStrategy: "join",
    include: {
      _count: { select: { rentas: true } },
      rentas: {
        select: {
          unidades: {
            select: { unidad: { select: { modelo: { select: { tipo: true } } } } },
          },
        },
      },
    },
    orderBy: { nombre: "asc" },
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
        <div className="flex-1 lg:hidden">
          <Buscador placeholder="Buscar cliente o teléfono" />
        </div>
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
                "border-b border-linea bg-superficie-suave px-[22px] py-3.5 text-[11.5px] font-bold tracking-wide text-tenue uppercase",
              )}
            >
              <span>Cliente</span>
              <span>Teléfono</span>
              <span>Origen</span>
              <span className="text-right">Rentas</span>
            </div>
            {clientes.map((c, i) => {
              const [bg, fg] = AV_PALETTE[i % AV_PALETTE.length];
              const tipos = tiposDeEquipoDeRentas(c.rentas);
              return (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  className={cn(
                    CLI_GRID,
                    "items-center border-b border-linea-suave px-[22px] py-3.5 hover:bg-superficie-hover",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex size-[38px] shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                      style={{ background: bg, color: fg }}
                    >
                      {iniciales(c.nombre)}
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate font-bold">{c.nombre}</span>
                      <DistintivoEquipos tipos={tipos} />
                    </div>
                  </div>
                  <span className="text-[13.5px] text-medio tabular-nums">
                    {formatoTelefono(c.telefono) || "—"}
                  </span>
                  <span>
                    <span className="rounded-full bg-superficie-activa px-2.5 py-1 text-xs font-bold text-primary">
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

          {/* Lista (móvil): una sola tarjeta con filas estilo iOS. */}
          <Card className="gap-0 overflow-hidden py-0 lg:hidden">
            {clientes.map((c, i) => {
              const [bg, fg] = AV_PALETTE[i % AV_PALETTE.length];
              const wa = linkWhatsApp(c.telefono);
              const nRentas = c._count.rentas;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 border-b last:border-b-0"
                >
                  <Link
                    href={`/clientes/${c.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-[15px] active:bg-muted/50"
                  >
                    <div
                      className="flex size-[42px] shrink-0 items-center justify-center rounded-full text-base font-extrabold"
                      style={{ background: bg, color: fg }}
                    >
                      {iniciales(c.nombre)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15.5px] leading-tight font-bold tracking-[-0.3px]">
                        {c.nombre}
                      </p>
                      <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                        {formatoTelefono(c.telefono) || "Sin teléfono"} · {nRentas}{" "}
                        {nRentas === 1 ? "renta" : "rentas"}
                      </p>
                    </div>
                  </Link>
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`WhatsApp a ${c.nombre}`}
                      className="mr-[15px] flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-emerald-600 active:scale-90 dark:text-emerald-500"
                    >
                      <MessageCircle className="size-[17px]" />
                    </a>
                  )}
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}
