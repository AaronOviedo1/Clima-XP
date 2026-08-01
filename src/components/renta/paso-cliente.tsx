"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { RentaFormApi } from "@/hooks/use-renta-form";
import { fechaDesdeInput } from "@/lib/fechas";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ClienteCombobox } from "@/components/cliente-combobox";
import { ClienteRapidoDialog } from "@/components/cliente-rapido-dialog";

// El calendario trabaja con Date locales; las fechas del formulario son "yyyy-MM-dd".
function fechaLocalDesdeInput(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Paso 1: para quién es la renta y qué días.
 *
 * El calendario ya no vive en un Popover: en el teléfono ocupaba media pantalla
 * con celdas de 28px. Aquí se muestra en la propia pantalla y con celdas
 * táctiles (`--cell-size`), que es donde más se equivocaba uno.
 */
export function PasoCliente({ form }: { form: RentaFormApi }) {
  const inicio = fechaLocalDesdeInput(form.fechaInicio);
  const fin = fechaLocalDesdeInput(form.fechaFin);
  const eligiendoFin = !!form.rangoCal?.from && !form.rangoCal.to;

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <Label>Cliente</Label>
        <div className="flex gap-2">
          <ClienteCombobox
            clientes={form.clientes}
            value={form.clienteId}
            onChange={form.setClienteId}
          />
          <ClienteRapidoDialog
            onCreado={(c) => {
              form.setClientes((prev) =>
                prev.some((x) => x.id === c.id)
                  ? prev
                  : [...prev, c].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
              );
              form.setClienteId(c.id);
            }}
          />
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label>Fechas de renta</Label>
          <span className="text-[13px] font-bold text-tenue tabular-nums">
            {form.dias} {form.dias === 1 ? "día" : "días"}
          </span>
        </div>

        <Card className="gap-0 overflow-hidden py-0">
          <p className="border-b px-4 py-2.5 text-[13px] font-semibold text-medio">
            {eligiendoFin
              ? "Ahora toca el día de recolección (o el mismo, para un solo día)."
              : "Toca el día de entrega."}
          </p>
          <div className="flex justify-center py-1">
            <Calendar
              mode="range"
              locale={es}
              numberOfMonths={1}
              defaultMonth={inicio}
              // Celdas grandes: en el teléfono las de 28px del default se
              // fallaban seguido.
              className="[--cell-size:--spacing(11)] sm:[--cell-size:--spacing(10)]"
              selected={form.rangoCal ?? { from: inicio, to: fin }}
              onSelect={(_rango, dia) => form.seleccionarDia(dia)}
            />
          </div>
          <div className="border-t px-4 py-3 text-[13.5px] font-semibold">
            {format(fechaDesdeInput(form.fechaInicio), "EEE d MMM", { locale: es })}
            <span className="px-1.5 text-tenue">→</span>
            {format(fechaDesdeInput(form.fechaFin), "EEE d MMM", { locale: es })}
          </div>
        </Card>
      </section>
    </div>
  );
}
