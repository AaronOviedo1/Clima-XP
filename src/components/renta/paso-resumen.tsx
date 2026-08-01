"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, MapPin, Truck, User } from "lucide-react";
import type { RentaFormApi } from "@/hooks/use-renta-form";
import { fechaDesdeInput } from "@/lib/fechas";
import { pesos } from "@/lib/dinero";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Fila, FilaInfo } from "@/components/renta/bloques";
import { BloqueCargos } from "@/components/renta/bloque-cargos";

/** Paso 4: qué se va a guardar, en qué estado, y lo opcional a un toque. */
export function PasoResumen({
  form,
  irAPaso,
}: {
  form: RentaFormApi;
  irAPaso: (paso: number) => void;
}) {
  const cliente = form.clientes.find((c) => c.id === form.clienteId);
  const equipos = form.grupos
    .filter((g) => g.seleccionadas.length > 0)
    .map((g) => `${g.seleccionadas.length} × ${g.nombre}`)
    .join(", ");

  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden py-0">
        <FilaInfo
          icono={<User className="size-[19px]" />}
          label="Cliente"
          value={
            <button type="button" onClick={() => irAPaso(0)} className="text-left">
              {cliente?.nombre ?? "Sin elegir"}
            </button>
          }
        />
        <FilaInfo
          icono={<Calendar className="size-[19px]" />}
          label="Fechas"
          value={
            <button type="button" onClick={() => irAPaso(0)} className="text-left">
              {format(fechaDesdeInput(form.fechaInicio), "d MMM", { locale: es })} –{" "}
              {format(fechaDesdeInput(form.fechaFin), "d MMM", { locale: es })} · {form.dias}{" "}
              {form.dias === 1 ? "día" : "días"}
            </button>
          }
        />
        <FilaInfo
          icono={<Truck className="size-[19px]" />}
          label="Equipos"
          value={
            <button type="button" onClick={() => irAPaso(1)} className="text-left">
              {equipos || "Sin elegir"}
            </button>
          }
        />
        <FilaInfo
          icono={<MapPin className="size-[19px]" />}
          label="Dirección"
          value={
            <button type="button" onClick={() => irAPaso(2)} className="text-left">
              {form.direccion || "Sin capturar"}
            </button>
          }
          borde={false}
        />
      </Card>

      {/* Renta o cotización: es lo único que cambia lo que pasa con el equipo. */}
      <section className="space-y-2">
        <Label>¿Se aparta el equipo?</Label>
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {(
            [
              ["CONFIRMADA", "Renta"],
              ["COTIZADA", "Cotización"],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              onClick={() => form.setEstado(valor)}
              className={cn(
                "h-10 flex-1 rounded-[9px] text-[13.5px] font-bold transition-colors",
                form.estado === valor
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {texto}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          {form.estado === "CONFIRMADA"
            ? "Aparta el equipo en esas fechas."
            : "Solo es un precio: no aparta equipo."}
        </p>
      </section>

      <Card className="gap-0 py-0">
        <div className="space-y-1.5 px-4 py-3.5">
          <Fila label={`Equipos · ${form.dias}d`} value={pesos(form.calc.subtotalEquipos)} />
          {form.calc.costoDomicilio > 0 && (
            <Fila label="Domicilio" value={pesos(form.calc.costoDomicilio)} />
          )}
          {form.calc.descuentoMonto > 0 && (
            <Fila label="Descuento" value={`−${pesos(form.calc.descuentoMonto)}`} />
          )}
          <Separator className="my-1" />
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Total</span>
            <span className="text-[22px] font-extrabold tabular-nums">
              {pesos(form.calc.total)}
            </span>
          </div>
        </div>
      </Card>

      <BloqueCargos form={form} />
    </div>
  );
}
