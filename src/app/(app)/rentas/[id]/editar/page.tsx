import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RentaEditar, nombreDeCliente } from "@/components/renta-editar";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditarRentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const nombre = await nombreDeCliente(id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Volver">
          <Link href={`/rentas/${id}`}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Editar renta</h1>
          {nombre && <p className="text-sm text-muted-foreground">{nombre}</p>}
        </div>
      </div>

      <RentaEditar id={id} />
    </div>
  );
}
