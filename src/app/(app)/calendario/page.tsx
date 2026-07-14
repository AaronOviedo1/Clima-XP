import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Flame, Wind } from "lucide-react";
import { datosCalendario, mesValido, sumarMeses } from "@/lib/calendario";
import { hoyNegocio } from "@/lib/fechas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarioMes } from "@/components/calendario-mes";

export const dynamic = "force-dynamic";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const mes = mesValido(params.mes);
  const { modelos, dias } = await datosCalendario(mes);

  const hoy = hoyNegocio();
  const mesActual = hoy.slice(0, 7);
  const tituloMes = format(new Date(`${mes}-01T12:00:00.000Z`), "MMMM yyyy", { locale: es });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Calendario de ocupación</h1>

      {/* Navegación de mes */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" className="size-11" asChild>
          <Link href={`/calendario?mes=${sumarMeses(mes, -1)}`} aria-label="Mes anterior">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div className="text-center">
          <div className="text-lg font-semibold first-letter:uppercase">{tituloMes}</div>
          {mes !== mesActual && (
            <Link href="/calendario" className="text-xs text-primary underline underline-offset-2">
              Volver a hoy
            </Link>
          )}
        </div>
        <Button variant="outline" size="icon" className="size-11" asChild>
          <Link href={`/calendario?mes=${sumarMeses(mes, 1)}`} aria-label="Mes siguiente">
            <ChevronRight className="size-5" />
          </Link>
        </Button>
      </div>

      {/* Qué significa cada abreviatura de la cuadrícula */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {modelos.map((m) => (
          <span key={m.id} className="flex items-center gap-1.5">
            {m.tipo === "AEROCOOLER" ? (
              <Wind className="size-3.5 shrink-0 text-sky-500" />
            ) : (
              <Flame className="size-3.5 shrink-0 text-orange-500" />
            )}
            <span className="font-semibold text-foreground">{m.abrev}</span>
            <span>
              {m.nombre} · {m.total} {m.total === 1 ? "unidad" : "unidades"}
            </span>
          </span>
        ))}
      </div>

      <Card className="py-0">
        <CardContent className="p-2 sm:p-3">
          <CalendarioMes modelos={modelos} dias={dias} hoy={hoy} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Cada celda muestra las <strong>unidades libres</strong> de cada modelo ese día (rentas
        confirmadas, en ruta o entregadas). Toca un día para ver sus rentas. El día de recolección
        la unidad ya cuenta como libre. No incluye unidades en mantenimiento o de baja.
      </p>
    </div>
  );
}
