import Link from "next/link";
import { Plus, Search, UserRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { normalizarTelefono, formatoTelefono } from "@/lib/telefono";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <Button asChild size="sm">
          <Link href="/clientes/nuevo">
            <Plus className="size-4" /> Nuevo
          </Link>
        </Button>
      </div>

      <form className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={busqueda}
          placeholder="Buscar por nombre o teléfono"
          className="h-11 pl-9"
        />
      </form>

      {clientes.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {busqueda ? "Sin resultados." : "Aún no hay clientes."}
        </p>
      ) : (
        <ul className="space-y-2">
          {clientes.map((c) => (
            <li key={c.id}>
              <Link href={`/clientes/${c.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      <UserRound className="size-5 text-muted-foreground" />
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
          ))}
        </ul>
      )}
    </div>
  );
}
