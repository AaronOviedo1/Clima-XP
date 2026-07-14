"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { sumarDiasInput } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// El calendario trabaja con Date locales; la fecha de la ruta es "yyyy-MM-dd".
function fechaLocal(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Navegador de día para /ruta: flechas para el día anterior/siguiente y un
// calendario para saltar directo (así se puede ir armando la ruta de otro día
// con anticipación, no solo ver la de hoy).
export function RutaFechaSelector({ fecha, hoy }: { fecha: string; hoy: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  const esHoy = fecha === hoy;
  const esManana = fecha === sumarDiasInput(hoy, 1);
  const esAyer = fecha === sumarDiasInput(hoy, -1);
  const etiqueta = esHoy ? "Hoy" : esManana ? "Mañana" : esAyer ? "Ayer" : null;

  function ir(nuevaFecha: string) {
    setAbierto(false);
    router.push(nuevaFecha === hoy ? "/ruta" : `/ruta?fecha=${nuevaFecha}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="size-11 shrink-0"
        onClick={() => ir(sumarDiasInput(fecha, -1))}
        aria-label="Día anterior"
      >
        <ChevronLeft className="size-5" />
      </Button>

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-11 flex-1 justify-center gap-2 text-base font-medium",
              esHoy && "border-primary/60 text-primary",
            )}
          >
            <CalendarIcon className="size-4 shrink-0 opacity-60" />
            <span className="truncate first-letter:uppercase">
              {format(fechaLocal(fecha), "EEE d 'de' MMMM", { locale: es })}
            </span>
            {etiqueta && (
              <Badge variant={esHoy ? "default" : "secondary"} className="shrink-0">
                {etiqueta}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            locale={es}
            numberOfMonths={1}
            defaultMonth={fechaLocal(fecha)}
            selected={fechaLocal(fecha)}
            onSelect={(dia) => dia && ir(format(dia, "yyyy-MM-dd"))}
          />
          <div className="flex gap-2 border-t p-2">
            <Button
              variant="ghost"
              className="h-9 flex-1"
              disabled={esHoy}
              onClick={() => ir(hoy)}
            >
              Hoy
            </Button>
            <Button
              variant="ghost"
              className="h-9 flex-1"
              disabled={esManana}
              onClick={() => ir(sumarDiasInput(hoy, 1))}
            >
              Mañana
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        className="size-11 shrink-0"
        onClick={() => ir(sumarDiasInput(fecha, 1))}
        aria-label="Día siguiente"
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}
