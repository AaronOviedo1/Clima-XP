"use client";

import { useRouter } from "next/navigation";
import { useRentaForm, type RentaEdicion } from "@/hooks/use-renta-form";
import type { UnidadOpcion } from "@/lib/actions/rentas";
import type { ClienteOpcion } from "@/components/cliente-combobox";
import { ESTADOS_CERRADOS, type EstadoRentaStr } from "@/lib/rentas";
import { pesos } from "@/lib/dinero";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PasoCliente } from "@/components/renta/paso-cliente";
import { PasoEquipos } from "@/components/renta/paso-equipos";
import { PasoDireccion } from "@/components/renta/paso-direccion";
import { BloqueCargos } from "@/components/renta/bloque-cargos";

export type { RentaEdicion };

/**
 * Edición de una renta existente: una sola pantalla con todo a la vista.
 *
 * A diferencia del alta —que va por pasos, porque se captura de cero (ver
 * `renta/alta-renta.tsx`)—, aquí se viene a corregir un dato suelto ("se movió
 * un día", "cambió la hora"): obligar a atravesar cuatro pantallas para tocar
 * un campo sería peor. Comparte el mismo hook y los mismos bloques, así que no
 * hay dos versiones de la lógica.
 */
export function RentaForm({
  clientes,
  unidadesIniciales,
  fechasIniciales,
  edicion,
  enModal = false,
}: {
  clientes: ClienteOpcion[];
  unidadesIniciales: UnidadOpcion[];
  fechasIniciales: { inicio: string; fin: string };
  edicion: RentaEdicion;
  enModal?: boolean;
}) {
  const router = useRouter();
  const form = useRentaForm({
    clientes,
    unidadesIniciales,
    fechasIniciales,
    edicion,
    alTerminar: enModal
      ? () => {
          // En pop-up: cerrarlo y volver al detalle, ya actualizado.
          router.back();
          router.refresh();
        }
      : undefined,
  });

  return (
    <div className="space-y-5">
      {edicion.bloquearUnidades && (
        <p className="rounded-xl bg-chip-ambar px-3.5 py-2.5 text-[13px] font-bold text-chip-ambar-fg">
          {ESTADOS_CERRADOS.includes(edicion.estado as EstadoRentaStr)
            ? "Renta cerrada: las unidades quedan fijas; solo puedes corregir fechas, datos y cargos."
            : "El equipo ya está en la calle: las unidades no se pueden cambiar, solo fechas y datos."}
        </p>
      )}

      <PasoCliente form={form} />
      <PasoEquipos form={form} />
      <PasoDireccion form={form} />
      <BloqueCargos form={form} />

      {/* Barra de guardado: sticky dentro del contenido, así funciona igual en
          pantalla completa y dentro del pop-up. */}
      <div
        className={cn(
          "sticky z-20",
          enModal ? "bottom-0 -mx-4 px-4 pb-3" : "bottom-[calc(env(safe-area-inset-bottom)+10px)]",
        )}
      >
        {form.error && (
          <p
            role="alert"
            className="mb-2 rounded-xl bg-chip-rojo px-3.5 py-2.5 text-[13px] font-bold text-chip-rojo-fg"
          >
            {form.error}
          </p>
        )}
        <div className="flex items-center gap-3 rounded-2xl border bg-background/95 p-2.5 shadow-lg backdrop-blur">
          <div className="min-w-0 flex-1 pl-1.5">
            <div className="text-[12px] font-semibold text-tenue">
              {form.calc.unidades.length} equipos · {form.dias}d
            </div>
            <div className="text-[22px] leading-tight font-extrabold tabular-nums">
              {pesos(form.calc.total)}
            </div>
          </div>
          <Button
            className="h-12 px-6 text-base"
            onClick={form.guardar}
            disabled={form.pendingSubmit}
          >
            {form.pendingSubmit ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}
