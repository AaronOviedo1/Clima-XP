import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { hoyNegocio, sumarDiasInput } from "@/lib/fechas";
import { unidadesParaFechas } from "@/lib/actions/rentas";
import { RentaForm } from "@/components/renta-form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NuevaRentaPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;

  const inicio = hoyNegocio();
  const fin = sumarDiasInput(inicio, 1);

  const [clientes, accesorios, unidadesIniciales] = await Promise.all([
    prisma.cliente.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.accesorio.findMany({
      select: { id: true, descripcion: true, tipo: true },
      orderBy: { descripcion: "asc" },
    }),
    unidadesParaFechas(inicio, fin),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Volver">
          <Link href="/rentas">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Nueva renta</h1>
      </div>

      {clientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Primero crea un cliente en{" "}
          <Link href="/clientes/nuevo" className="underline">
            Clientes
          </Link>
          .
        </p>
      ) : (
        <RentaForm
          clientes={clientes}
          accesorios={accesorios}
          unidadesIniciales={unidadesIniciales}
          fechasIniciales={{ inicio, fin }}
          clientePreseleccionado={cliente}
        />
      )}
    </div>
  );
}
