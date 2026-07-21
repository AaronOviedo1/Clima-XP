import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { datosCalendario, mesValido, sumarMeses } from "@/lib/calendario";
import { hoyNegocio } from "@/lib/fechas";
import { Button } from "@/components/ui/button";
import { CalendarioMes } from "@/components/calendario-mes";

export const dynamic = "force-dynamic";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const mes = mesValido(params.mes);
  const { dias, modelos } = await datosCalendario(mes);

  const hoy = hoyNegocio();
  const mesActual = hoy.slice(0, 7);
  const tituloMes = format(new Date(`${mes}-01T12:00:00.000Z`), "MMMM yyyy", { locale: es });

  return (
    <div className="space-y-4">
      {/* Título móvil (en desktop lo cubre el TopBar). */}
      <div className="lg:hidden">
        <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em]">
          Calendario
        </h1>
        <p className="mt-0.5 text-[13.5px] font-medium text-muted-foreground">
          Ocupación de unidades por día
        </p>
      </div>

      {/* Navegación de mes: título a la izquierda, chevrons (y leyenda en desktop) a la derecha */}
      <div className="flex items-center gap-3.5">
        <div className="min-w-0">
          <div className="text-xl font-extrabold tracking-tight first-letter:uppercase">
            {tituloMes}
          </div>
          {mes !== mesActual && (
            <Link href="/calendario" className="text-xs text-primary underline underline-offset-2">
              Volver a hoy
            </Link>
          )}
        </div>
        <div className="flex-1" />
        <div className="hidden flex-wrap justify-end gap-x-4 gap-y-1 text-[13px] text-muted-foreground lg:flex">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="size-2.5 rounded-full bg-primary" /> Entregas
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="size-2.5 rounded-full bg-[#ea6a2e]" /> Recolecciones
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="size-10" asChild>
            <Link href={`/calendario?mes=${sumarMeses(mes, -1)}`} aria-label="Mes anterior">
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
          <Button variant="outline" size="icon" className="size-10" asChild>
            <Link href={`/calendario?mes=${sumarMeses(mes, 1)}`} aria-label="Mes siguiente">
              <ChevronRight className="size-5" />
            </Link>
          </Button>
        </div>
      </div>

      <CalendarioMes dias={dias} modelos={modelos} hoy={hoy} />

      <p className="hidden text-xs text-muted-foreground lg:block">
        Cada día marca sus <strong>entregas</strong> y <strong>recolecciones</strong> programadas.
        Toca un día para ver el detalle de sus rentas.
      </p>
    </div>
  );
}
