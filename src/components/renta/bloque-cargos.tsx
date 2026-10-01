"use client";

import type { RentaFormApi } from "@/hooks/use-renta-form";
import { pesos } from "@/lib/dinero";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Colapsable } from "@/components/renta/bloques";

const METODOS = [
  { v: "EFECTIVO", l: "Efectivo" },
  { v: "TRANSFERENCIA", l: "Transferencia" },
  { v: "LINK_MERCADO_PAGO", l: "Link Mercado Pago" },
  { v: "OTRO", l: "Otro" },
];

/**
 * El "+ IVA" a la vista, y debajo descuento, anticipo y notas: lo que casi
 * nunca se toca, plegado. Lo comparten el último paso del alta y la pantalla
 * de edición.
 *
 * El interruptor no va dentro del colapsable porque cambia el total: escondido
 * ahí se guardaba la renta sin IVA y nadie lo notaba hasta cobrar.
 *
 * Los campos van apilados, no en `grid-cols-2`: en un iPhone esas dos columnas
 * dejaban campos de ~165px donde no cabía "25% renta larga".
 */
export function BloqueCargos({ form }: { form: RentaFormApi }) {
  const conAnticipo = !form.edicion && form.estado !== "COTIZADA";

  return (
    <div className="space-y-4">
      {/* Toda la fila es el área de toque, no solo el interruptor. */}
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-bold">+ IVA (16%)</span>
          <span className="block text-[12.5px] text-muted-foreground">
            {form.requiereFactura && form.calc.iva > 0
              ? `Suma ${pesos(form.calc.iva)} al total. El domicilio no lleva IVA.`
              : "Solo sobre el equipo; el domicilio no lleva IVA."}
          </span>
        </span>
        <Switch
          className="origin-right scale-150"
          checked={form.requiereFactura}
          onCheckedChange={form.setRequiereFactura}
        />
      </label>

      <Colapsable
        titulo="Descuento y cobro"
        abierto={form.descuentoMonto > 0 || form.anticipoMonto > 0}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="desc">Descuento</Label>
            <Input
              id="desc"
              type="number"
              inputMode="numeric"
              value={form.descuentoMonto === 0 ? "" : form.descuentoMonto}
              placeholder="0"
              className="h-11"
              onChange={(e) => form.setDescuentoMonto(Math.max(0, parseInt(e.target.value) || 0))}
            />
            {form.descuentoMonto > 0 && (
              <Input
                value={form.descuentoNota}
                placeholder="Motivo (25% renta larga)"
                className="h-11"
                onChange={(e) => form.setDescuentoNota(e.target.value)}
              />
            )}
          </div>

          {conAnticipo && (
            <div className="space-y-2">
              <Label htmlFor="anticipo">Anticipo</Label>
              <Input
                id="anticipo"
                type="number"
                inputMode="numeric"
                value={form.anticipoMonto === 0 ? "" : form.anticipoMonto}
                placeholder="0"
                className="h-11"
                onChange={(e) => form.setAnticipoMonto(Math.max(0, parseInt(e.target.value) || 0))}
              />
              {form.anticipoMonto > 0 && (
                <Select value={form.anticipoMetodo} onValueChange={form.setAnticipoMetodo}>
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METODOS.map((m) => (
                      <SelectItem key={m.v} value={m.v}>
                        {m.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>
      </Colapsable>

      <Colapsable titulo="Notas" abierto={!!form.notas}>
        <Textarea
          value={form.notas}
          rows={3}
          placeholder="Lo que haya que recordar de esta renta"
          onChange={(e) => form.setNotas(e.target.value)}
        />
      </Colapsable>
    </div>
  );
}
