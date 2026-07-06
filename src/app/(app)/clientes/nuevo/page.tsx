import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { crearCliente } from "@/lib/actions/clientes";
import { ClienteForm } from "@/components/cliente-form";
import { Button } from "@/components/ui/button";

export default function NuevoClientePage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Volver">
          <Link href="/clientes">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo cliente</h1>
      </div>
      <ClienteForm accion={crearCliente} textoBoton="Crear cliente" />
    </div>
  );
}
