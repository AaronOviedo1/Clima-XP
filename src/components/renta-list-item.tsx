import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { fechaCorta } from "@/lib/fechas";
import { pesos } from "@/lib/dinero";
import {
  totalesDeRenta,
  ESTADO_RENTA_META,
  type RentaCompleta,
} from "@/lib/rentas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function RentaListItem({
  renta,
  mostrarCliente = true,
}: {
  renta: RentaCompleta;
  mostrarCliente?: boolean;
}) {
  const t = totalesDeRenta(renta);
  const meta = ESTADO_RENTA_META[renta.estado];
  const equipos = renta.unidades.length;

  return (
    <Link href={`/rentas/${renta.id}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {mostrarCliente && (
                <span className="truncate font-medium">
                  {renta.cliente.nombre}
                </span>
              )}
              <Badge variant={meta.badge}>{meta.label}</Badge>
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <CalendarDays className="size-3.5" />
              {fechaCorta(renta.fechaInicio)} → {fechaCorta(renta.fechaFin)}
              <span className="text-xs">
                · {equipos} {equipos === 1 ? "equipo" : "equipos"}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{pesos(t.total)}</p>
            {t.saldo > 0 ? (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-500">
                Debe {pesos(t.saldo)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Pagado</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
