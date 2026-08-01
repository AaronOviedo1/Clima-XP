"use client";

import { Minus, Plus } from "lucide-react";
import type { RentaFormApi } from "@/hooks/use-renta-form";
import { pesos } from "@/lib/dinero";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Colapsable } from "@/components/renta/bloques";

/**
 * Paso 2: cuántos equipos de cada modelo.
 *
 * Se elige por cantidad, no por código: con 20 calentones, tocar chips uno por
 * uno era el peor momento del formulario en el teléfono. Los códigos se asignan
 * solos entre los libres; quien necesite uno en particular lo cambia en
 * "Elegir códigos".
 */
export function PasoEquipos({ form }: { form: RentaFormApi }) {
  const bloqueado = !!form.edicion?.bloquearUnidades;

  return (
    <div className="space-y-4">
      {bloqueado && (
        <p className="rounded-xl bg-chip-ambar px-3.5 py-2.5 text-[13px] font-bold text-chip-ambar-fg">
          El equipo ya está en la calle: las unidades no se pueden cambiar.
        </p>
      )}

      {form.grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {form.cargandoUnidades
            ? "Buscando equipos libres…"
            : "No hay equipos libres en esas fechas. Cambia las fechas en el paso anterior."}
        </p>
      ) : (
        form.grupos.map((g) => {
          const cantidad = g.seleccionadas.length;
          return (
            <Card key={g.modeloId} className="gap-0 py-0">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[15.5px] font-bold tracking-[-0.3px]">{g.nombre}</div>
                  <div className="text-[12.5px] text-muted-foreground tabular-nums">
                    {pesos(g.precioDia)}/día · {g.disponibles.length} libres
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Quitar ${g.nombre}`}
                    disabled={bloqueado || cantidad === 0}
                    onClick={() => form.ponerCantidad(g.modeloId, cantidad - 1)}
                    className="flex size-11 items-center justify-center rounded-full border border-linea text-medio transition-transform active:scale-90 disabled:opacity-40"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-8 text-center text-[19px] font-extrabold tabular-nums">
                    {cantidad}
                  </span>
                  <button
                    type="button"
                    aria-label={`Agregar ${g.nombre}`}
                    disabled={bloqueado || cantidad >= g.disponibles.length}
                    onClick={() => form.ponerCantidad(g.modeloId, cantidad + 1)}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-40",
                      cantidad > 0
                        ? "bg-primary text-primary-foreground"
                        : "border border-linea text-medio",
                    )}
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
              {cantidad > 0 && (
                <div className="border-t px-4 py-2 text-[12.5px] font-semibold text-tenue tabular-nums">
                  {g.seleccionadas.map((u) => u.codigo).join(" · ")}
                </div>
              )}
            </Card>
          );
        })
      )}

      {form.calc.aplicaPrecio3Mas && (
        <p className="rounded-xl bg-chip-verde px-3.5 py-2.5 text-[13px] font-bold text-chip-verde-fg">
          Aplica precio de 3+ calentones.
        </p>
      )}

      {/* Para el caso raro: que salga una unidad concreta (color, estado…). */}
      {!bloqueado && form.grupos.length > 0 && (
        <Colapsable titulo="Elegir códigos">
          <div className="space-y-3">
            {form.grupos.map((g) => (
              <div key={g.modeloId} className="space-y-1.5">
                <p className="text-[13px] font-semibold text-medio">{g.nombre}</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {g.disponibles.map((u) => {
                    const activo = form.sel.has(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => form.toggleUnidad(u.id)}
                        className={cn(
                          "h-11 rounded-xl border text-[13px] font-bold transition-colors",
                          activo
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-linea bg-card active:bg-superficie-hover",
                        )}
                      >
                        {u.codigo}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Colapsable>
      )}
    </div>
  );
}
