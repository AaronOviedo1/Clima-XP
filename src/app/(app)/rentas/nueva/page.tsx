import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RentaNueva } from "@/components/renta-nueva";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NuevaRentaPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;

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

      <RentaNueva clientePreseleccionado={cliente} />
    </div>
  );
}
