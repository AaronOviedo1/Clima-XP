"use client";

import type { RentaFormApi } from "@/hooks/use-renta-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
 * Descuento, factura, anticipo y notas: lo que casi nunca se toca, plegado.
 * Lo comparten el último paso del alta y la pantalla de edición.
 *
 * Los campos van apilados, no en `grid-cols-2`: en un iPhone esas dos columnas
 * dejaban campos de ~165px donde no cabía "25% renta larga".
 */
export function BloqueCargos({ form }: { form: RentaFormApi }) {
  const conAnticipo = !form.edicion && form.estado !== "COTIZADA";

  return (
    <div className="space-y-4">
      <Colapsable
        titulo="Descuento y cobro"
        abierto={form.descuentoMonto > 0 || form.anticipoMonto > 0 || form.requiereFactura}
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

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.requiereFactura}
              onCheckedChange={(v) => form.setRequiereFactura(v === true)}
            />
            Requiere factura (agrega IVA a la cotización)
          </label>

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
