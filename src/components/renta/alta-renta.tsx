"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useRentaForm } from "@/hooks/use-renta-form";
import type { UnidadOpcion } from "@/lib/actions/rentas";
import type { ClienteOpcion } from "@/components/cliente-combobox";
import { pesos } from "@/lib/dinero";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PasoCliente } from "@/components/renta/paso-cliente";
import { PasoEquipos } from "@/components/renta/paso-equipos";
import { PasoDireccion } from "@/components/renta/paso-direccion";
import { PasoResumen } from "@/components/renta/paso-resumen";

/**
 * Alta de renta en cuatro pasos, pensada para el teléfono: una cosa a la vez,
 * con la acción principal siempre al alcance del pulgar.
 *
 * El paso vive en `useState`, no en la URL: el alta es una sola pantalla y el
 * gesto de "atrás" del teléfono debe salir del alta, no retroceder de paso
 * (para eso está la flecha del header).
 *
 * La barra de acción es **sticky dentro del contenido**, no `fixed`: así
 * respeta el ancho del contenedor (no cruza bajo el sidebar en escritorio) y se
 * coloca sobre el BottomNav usando su altura real (~68px + safe-area), que es
 * lo que antes estaba calculado a ojo.
 */

const PASOS = [
  { titulo: "Cliente y fechas", corto: "Cliente" },
  { titulo: "Equipos", corto: "Equipos" },
  { titulo: "Entrega", corto: "Entrega" },
  { titulo: "Revisar", corto: "Revisar" },
] as const;

export function AltaRenta({
  clientes,
  unidadesIniciales,
  fechasIniciales,
  clientePreseleccionado,
}: {
  clientes: ClienteOpcion[];
  unidadesIniciales: UnidadOpcion[];
  fechasIniciales: { inicio: string; fin: string };
  clientePreseleccionado?: string;
}) {
  const form = useRentaForm({
    clientes,
    unidadesIniciales,
    fechasIniciales,
    clientePreseleccionado,
  });
  const [paso, setPaso] = useState(0);

  // Qué falta para poder salir de cada paso. El error se pinta dentro del paso
  // visible, no al final del formulario como antes.
  const validaciones = [form.faltaCliente, form.faltaEquipo, form.faltaDireccion, form.faltaCargos];

  const [verificando, setVerificando] = useState(false);

  async function avanzar() {
    // Al salir del paso de entrega se resuelve la dirección que quedó
    // pendiente: en el teléfono se escribe y se toca "Siguiente" sin salir del
    // campo, y sin esto el resumen mostraría el total sin el domicilio.
    if (paso === 2) {
      setVerificando(true);
      const fuera = await form.resolverUbicacionPendiente();
      setVerificando(false);
      if (fuera) {
        form.setError(fuera);
        return;
      }
    }

    const problema = validaciones[paso]();
    if (problema) {
      form.setError(problema);
      return;
    }
    form.setError(null);
    if (paso < PASOS.length - 1) irAPaso(paso + 1);
    else form.guardar();
  }

  function irAPaso(destino: number) {
    // Hacia adelante se valida lo que quedó atrás; hacia atrás siempre se puede.
    if (destino > paso) {
      for (let i = paso; i < destino; i++) {
        const problema = validaciones[i]();
        if (problema) {
          setPaso(i);
          form.setError(problema);
          return;
        }
      }
    }
    form.setError(null);
    setPaso(destino);
    window.scrollTo({ top: 0 });
  }

  // El paso vive solo en el estado, sin tocar la URL ni el historial: meter
  // entradas a mano (para que el gesto de "atrás" retroceda de paso) dejaba al
  // router de Next desincronizado y el `push` al detalle tras guardar no se
  // ejecutaba. Para retroceder está la flecha del header; el gesto del teléfono
  // sale del alta, como en cualquier otra pantalla.

  const ultimo = paso === PASOS.length - 1;
  const textoAccion = ultimo
    ? form.estado === "COTIZADA"
      ? "Crear cotización"
      : "Crear renta"
    : "Siguiente";

  return (
    // Columna a lo alto de la pantalla: con poco contenido (el paso 1 cabe
    // entero) la isla de acción se queda abajo igual, no a media pantalla.
    <div className="flex min-h-[calc(100dvh-var(--spacing)*24)] flex-col lg:min-h-[calc(100dvh-var(--spacing)*20)]">
      {/* Header sticky (móvil): volver + paso actual. Los márgenes negativos
          cancelan el padding del <main>. */}
      <div className="sticky top-0 z-20 -mx-5 -mt-[calc(env(safe-area-inset-top)+14px)] mb-4 flex items-center gap-2 border-b bg-background/80 px-3 pt-[calc(env(safe-area-inset-top)+10px)] pb-2.5 backdrop-blur-xl lg:hidden">
        {paso === 0 ? (
          <Link
            href="/rentas"
            className="flex items-center gap-0.5 px-2 py-1.5 text-[16px] font-semibold text-primary active:opacity-50"
          >
            <ChevronLeft className="size-[22px]" /> Rentas
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => irAPaso(paso - 1)}
            className="flex items-center gap-0.5 px-2 py-1.5 text-[16px] font-semibold text-primary active:opacity-50"
          >
            <ChevronLeft className="size-[22px]" /> Atrás
          </button>
        )}
        <div className="flex-1" />
        <span className="pr-2 text-[13px] font-bold text-tenue tabular-nums">
          {paso + 1} de {PASOS.length}
        </span>
      </div>

      <h1 className="mb-3 hidden text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] lg:block">
        Nueva renta
      </h1>

      {/* Indicador tocable: también sirve para saltar de paso. */}
      <div className="mb-4 flex gap-1 rounded-xl bg-muted p-1">
        {PASOS.map((p, i) => (
          <button
            key={p.corto}
            type="button"
            onClick={() => irAPaso(i)}
            className={cn(
              "h-9 flex-1 rounded-[9px] text-[13px] font-bold transition-colors",
              i === paso ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {p.corto}
          </button>
        ))}
      </div>

      <h2 className="mb-3 text-[22px] leading-tight font-extrabold tracking-[-0.02em] lg:text-[24px]">
        {PASOS[paso].titulo}
      </h2>

      <div className="flex-1">
        {paso === 0 && <PasoCliente form={form} />}
        {paso === 1 && <PasoEquipos form={form} />}
        {paso === 2 && <PasoDireccion form={form} />}
        {paso === 3 && <PasoResumen form={form} irAPaso={irAPaso} />}
      </div>

      {/* Isla de acción: sticky (no fixed) para que respete el contenedor y no
          cruce bajo el sidebar en escritorio. El BottomNav se esconde durante
          el alta (ver ocultarTabBar en lib/nav.ts), así que va pegada abajo. */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+10px)] z-20 mt-5 lg:bottom-5">
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
            onClick={avanzar}
            disabled={form.pendingSubmit || verificando}
          >
            {form.pendingSubmit ? "Guardando…" : verificando ? "Calculando…" : textoAccion}
          </Button>
        </div>
      </div>
    </div>
  );
}
