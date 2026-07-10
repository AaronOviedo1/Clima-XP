import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Flame, Wind } from "lucide-react";
import { datosCalendario, mesValido, sumarMeses } from "@/lib/calendario";
import { hoyNegocio } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function claseDeCelda(libres: number, total: number): string {
  if (libres === 0) return "bg-red-500/10 font-semibold text-red-600 dark:text-red-500";
  if (libres < total) return "bg-amber-500/10 font-medium text-amber-700 dark:text-amber-500";
  return "text-muted-foreground";
}

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
          <div className="text-lg font-semibold capitalize">{tituloMes}</div>
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

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500/70" /> Sin unidades libres
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500/70" /> Ocupación parcial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/40" /> Todo libre
        </span>
      </div>

      <Card className="py-0">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium backdrop-blur">
                  Día
                </th>
                {modelos.map((m) => (
                  <th key={m.id} className="min-w-24 px-2 py-2 text-center font-medium">
                    <div className="flex items-center justify-center gap-1">
                      {m.tipo === "AEROCOOLER" ? (
                        <Wind className="size-3.5 shrink-0 text-sky-500" />
                      ) : (
                        <Flame className="size-3.5 shrink-0 text-orange-500" />
                      )}
                      <span className="whitespace-nowrap">{m.nombre}</span>
                    </div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {m.total} {m.total === 1 ? "unidad" : "unidades"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dias.map((d) => {
                const fecha = new Date(`${d.fecha}T12:00:00.000Z`);
                const diaSemana = format(fecha, "EEE", { locale: es });
                const esHoy = d.fecha === hoy;
                const esPasado = d.fecha < hoy;
                const esFinDeSemana = [0, 6].includes(fecha.getUTCDay());
                return (
                  <tr
                    key={d.fecha}
                    className={cn(
                      "border-b last:border-b-0",
                      esHoy && "bg-primary/10",
                      !esHoy && esFinDeSemana && "bg-muted/30",
                      esPasado && "opacity-50",
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 whitespace-nowrap bg-background px-3 py-1.5 capitalize",
                        esHoy && "font-bold text-primary",
                      )}
                    >
                      {diaSemana} {d.dia}
                      {esHoy && <span className="ml-1 text-xs font-normal">· hoy</span>}
                    </td>
                    {modelos.map((m) => {
                      const libres = d.libresPorModelo[m.id];
                      return (
                        <td
                          key={m.id}
                          className={cn(
                            "px-2 py-1.5 text-center tabular-nums",
                            claseDeCelda(libres, m.total),
                          )}
                          title={`${m.nombre}: ${libres} de ${m.total} libres`}
                        >
                          {libres}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Unidades libres por día (rentas confirmadas, en ruta o entregadas). No incluye unidades en
        mantenimiento o de baja.
      </p>
    </div>
  );
}
