import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { datosCalendario, mesValido, sumarMeses } from "@/lib/calendario";
import { hoyNegocio } from "@/lib/fechas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarioMes } from "@/components/calendario-mes";

export const dynamic = "force-dynamic";

function Leyenda() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
      <span className="flex items-center gap-1.5 font-semibold">
        <span className="size-2.5 rounded-full bg-primary" /> Entregas
      </span>
      <span className="flex items-center gap-1.5 font-semibold">
        <span className="size-2.5 rounded-full bg-[#ea6a2e]" /> Recolecciones
      </span>
    </div>
  );
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const mes = mesValido(params.mes);
  const { dias } = await datosCalendario(mes);

  const hoy = hoyNegocio();
  const mesActual = hoy.slice(0, 7);
  const tituloMes = format(new Date(`${mes}-01T12:00:00.000Z`), "MMMM yyyy", { locale: es });

  return (
    <div className="space-y-4">
      <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em] lg:hidden">Calendario</h1>

      {/* Navegación de mes (+ leyenda a la derecha en desktop) */}
      <div className="flex items-center gap-3.5">
        <Button variant="outline" size="icon" className="size-10" asChild>
          <Link href={`/calendario?mes=${sumarMeses(mes, -1)}`} aria-label="Mes anterior">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-[170px] text-center lg:min-w-0 lg:text-left">
          <div className="text-xl font-extrabold tracking-tight first-letter:uppercase">
            {tituloMes}
          </div>
          {mes !== mesActual && (
            <Link href="/calendario" className="text-xs text-primary underline underline-offset-2">
              Volver a hoy
            </Link>
          )}
        </div>
        <Button variant="outline" size="icon" className="size-10" asChild>
          <Link href={`/calendario?mes=${sumarMeses(mes, 1)}`} aria-label="Mes siguiente">
            <ChevronRight className="size-5" />
          </Link>
        </Button>
        <div className="hidden flex-1 lg:block" />
        <div className="hidden lg:block">
          <Leyenda />
        </div>
      </div>

      {/* Leyenda (móvil) */}
      <div className="lg:hidden">
        <Leyenda />
      </div>

      <Card className="py-0">
        <CardContent className="p-3 sm:p-3.5">
          <CalendarioMes dias={dias} hoy={hoy} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Cada día marca sus <strong>entregas</strong> y <strong>recolecciones</strong> programadas
        (aerocoolers y calentones). Toca un día para ver el detalle de sus rentas.
      </p>
    </div>
  );
}
