import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { editarCliente } from "@/lib/actions/clientes";
import { ClienteForm } from "@/components/cliente-form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) notFound();

  const accion = editarCliente.bind(null, id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Volver">
          <Link href={`/clientes/${id}`}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Editar cliente</h1>
      </div>
      <ClienteForm
        accion={accion}
        textoBoton="Guardar cambios"
        inicial={{
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          canalOrigen: cliente.canalOrigen,
          notas: cliente.notas,
        }}
      />
    </div>
  );
}
