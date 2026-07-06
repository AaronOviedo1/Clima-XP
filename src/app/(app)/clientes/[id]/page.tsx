import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageCircle, Pencil, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { rentaInclude } from "@/lib/rentas";
import { formatoTelefono, paraWhatsApp } from "@/lib/telefono";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RentaListItem } from "@/components/renta-list-item";

export const dynamic = "force-dynamic";

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      rentas: { include: rentaInclude, orderBy: { fechaInicio: "desc" } },
    },
  });
  if (!cliente) notFound();

  const wa = paraWhatsApp(cliente.telefono);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Volver">
          <Link href="/clientes">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="flex-1 truncate text-2xl font-bold tracking-tight">
          {cliente.nombre}
        </h1>
        <Button asChild variant="outline" size="icon" aria-label="Editar">
          <Link href={`/clientes/${cliente.id}/editar`}>
            <Pencil className="size-4" />
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-2 py-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Teléfono</span>
            <span>{formatoTelefono(cliente.telefono) || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Canal</span>
            <Badge variant="secondary">{cliente.canalOrigen}</Badge>
          </div>
          {cliente.notas && (
            <div className="pt-1">
              <p className="text-muted-foreground">Notas</p>
              <p className="whitespace-pre-wrap">{cliente.notas}</p>
            </div>
          )}
          {wa && (
            <Button asChild variant="outline" className="mt-2 w-full">
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Rentas ({cliente.rentas.length})
        </h2>
        <Button asChild size="sm" variant="outline">
          <Link href={`/rentas/nueva?cliente=${cliente.id}`}>
            <Plus className="size-4" /> Nueva renta
          </Link>
        </Button>
      </div>

      {cliente.rentas.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sin rentas todavía</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-2">
          {cliente.rentas.map((r) => (
            <li key={r.id}>
              <RentaListItem renta={r} mostrarCliente={false} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
