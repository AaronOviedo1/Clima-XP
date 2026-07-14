import Link from "next/link";
import { CalendarDays, Package } from "lucide-react";
import { fechaCorta } from "@/lib/fechas";
import { pesos } from "@/lib/dinero";
import {
  equiposPorModelo,
  totalesDeRenta,
  ESTADO_RENTA_META,
  type RentaParaTotales,
  type UnidadConModelo,
} from "@/lib/rentas";

// Forma mínima que necesita la tarjeta; la satisfacen RentaLista,
// RentaTarjeta y RentaCompleta.
export type RentaListItemData = Omit<RentaParaTotales, "unidades"> & {
  id: string;
  estado: string;
  cliente: { nombre: string };
  unidades: ({ precioDia: number } & UnidadConModelo)[];
};
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { claseColorDia } from "@/lib/colores-dia";
import { cn } from "@/lib/utils";

export function RentaListItem({
  renta,
  mostrarCliente = true,
}: {
  renta: RentaListItemData;
  mostrarCliente?: boolean;
}) {
  const t = totalesDeRenta(renta);
  const meta = ESTADO_RENTA_META[renta.estado];
  const equipos = equiposPorModelo(renta.unidades);

  return (
    <Link href={`/rentas/${renta.id}`}>
      <Card
        className={cn(
          "transition-[filter] hover:brightness-[0.97] dark:hover:brightness-110",
          claseColorDia(renta.fechaInicio)
        )}
      >
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
            </p>
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Package className="size-3.5 shrink-0" />
              {equipos.length === 0 ? (
                <span className="italic">Sin equipos</span>
              ) : (
                equipos
                  .map((e) => `${e.cantidad} × ${e.nombre}`)
                  .join(" · ")
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{pesos(t.total)}</p>
            {t.saldo > 0 ? (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-500">
                Debe {pesos(t.saldo)}
              </p>
            ) : t.pagadoConfirmado >= t.total ? (
              <p className="text-xs text-muted-foreground">Pagado</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
