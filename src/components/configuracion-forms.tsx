"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ExternalLink, Flame, Trash2, Wind } from "lucide-react";
import { toast } from "sonner";
import {
  agregarTarifa,
  eliminarTarifa,
  guardarBodega,
  guardarPrecios,
  guardarTarifas,
  quitarBodega,
  type ConfigFormState,
} from "@/lib/actions/configuracion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Guardar({ texto = "Guardar" }: { texto?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
      {pending ? "Guardando…" : texto}
    </Button>
  );
}

function Mensaje({ state }: { state: ConfigFormState }) {
  if (!state) return null;
  if (state.error) return <p className="text-sm text-destructive">{state.error}</p>;
  if (state.ok)
    return <p className="text-sm text-emerald-600 dark:text-emerald-500">{state.ok}</p>;
  return null;
}

// Dispara un toast cuando el resultado de una action de configuración cambia.
function useToastConfig(state: ConfigFormState) {
  useEffect(() => {
    if (!state) return;
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success(state.ok);
  }, [state]);
}

// ---------- Precios por modelo ----------

export type ModeloPrecio = {
  id: string;
  nombre: string;
  tipo: "AEROCOOLER" | "CALENTON";
  precioDia: number;
  precioDia3Mas: number | null;
  numUnidades: number;
};

export function PreciosForm({ modelos }: { modelos: ModeloPrecio[] }) {
  const [state, formAction] = useActionState<ConfigFormState, FormData>(
    guardarPrecios,
    undefined,
  );
  useToastConfig(state);

  return (
    <form action={formAction} className="space-y-4">
      {modelos.map((m) => (
        <div key={m.id} className="space-y-2 rounded-md border p-3">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {m.tipo === "AEROCOOLER" ? (
              <Wind className="size-4 text-sky-500" />
            ) : (
              <Flame className="size-4 text-orange-500" />
            )}
            {m.nombre}
            <span className="font-normal text-muted-foreground">
              · {m.numUnidades} {m.numUnidades === 1 ? "unidad" : "unidades"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`precioDia-${m.id}`} className="text-xs text-muted-foreground">
                Por día ($)
              </Label>
              <Input
                id={`precioDia-${m.id}`}
                name={`precioDia-${m.id}`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                defaultValue={m.precioDia}
                className="h-11"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`precioDia3Mas-${m.id}`} className="text-xs text-muted-foreground">
                Con 3+ unidades ($)
              </Label>
              <Input
                id={`precioDia3Mas-${m.id}`}
                name={`precioDia3Mas-${m.id}`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                defaultValue={m.precioDia3Mas ?? ""}
                placeholder="—"
                className="h-11"
              />
            </div>
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Los cambios solo afectan rentas nuevas: cada renta guarda su precio al momento de crearse.
      </p>
      <Mensaje state={state} />
      <Guardar texto="Guardar precios" />
    </form>
  );
}

// ---------- Tarifa de domicilio por km ----------

export type TarifaKm = { id: string; kmMax: number; costo: number };

export function TarifasForm({ tarifas }: { tarifas: TarifaKm[] }) {
  const [state, formAction] = useActionState<ConfigFormState, FormData>(
    guardarTarifas,
    undefined,
  );
  const [borrado, setBorrado] = useState<ConfigFormState>(undefined);
  const [borrando, startBorrar] = useTransition();
  useToastConfig(state);
  useToastConfig(borrado);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {tarifas.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            <Label
              htmlFor={`costo-${t.id}`}
              className="w-14 shrink-0 text-sm tabular-nums text-muted-foreground"
            >
              {t.kmMax} km
            </Label>
            <Input
              id={`costo-${t.id}`}
              name={`costo-${t.id}`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              required
              defaultValue={t.costo}
              className="h-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
              disabled={borrando}
              aria-label={`Eliminar tarifa de ${t.kmMax} km`}
              onClick={() =>
                startBorrar(async () => {
                  setBorrado(await eliminarTarifa(t.id));
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Mensaje state={state ?? borrado} />
      <Guardar texto="Guardar tarifas" />
    </form>
  );
}

export function AgregarTarifaForm() {
  const [state, formAction] = useActionState<ConfigFormState, FormData>(
    agregarTarifa,
    undefined,
  );
  useToastConfig(state);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex gap-2">
        <div className="w-24 space-y-1">
          <Label htmlFor="km" className="text-xs text-muted-foreground">
            Km
          </Label>
          <Input id="km" name="km" type="number" inputMode="numeric" min={1} step={1} required className="h-11" />
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor="costo" className="text-xs text-muted-foreground">
            Costo ($)
          </Label>
          <Input id="costo" name="costo" type="number" inputMode="numeric" min={0} step={1} required className="h-11" />
        </div>
      </div>
      <Mensaje state={state} />
      <Guardar texto="Agregar tarifa" />
    </form>
  );
}

// ---------- Bodega ----------

export function BodegaForm({
  bodega,
}: {
  bodega: { coords: { lat: number; lng: number }; fuente: "bd" | "env" } | null;
}) {
  const [state, formAction] = useActionState<ConfigFormState, FormData>(
    guardarBodega,
    undefined,
  );
  const [quitado, setQuitado] = useState<ConfigFormState>(undefined);
  const [quitando, startQuitar] = useTransition();
  useToastConfig(state);
  useToastConfig(quitado);

  return (
    <div className="space-y-4">
      {bodega ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="tabular-nums">
            {bodega.coords.lat.toFixed(5)}, {bodega.coords.lng.toFixed(5)}
          </span>
          <Badge variant={bodega.fuente === "bd" ? "default" : "outline"}>
            {bodega.fuente === "bd" ? "Guardada aquí" : "Desde variables de entorno"}
          </Badge>
          <a
            href={`https://www.google.com/maps?q=${bodega.coords.lat},${bodega.coords.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary underline underline-offset-2"
          >
            Ver en Maps <ExternalLink className="size-3.5" />
          </a>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sin coordenadas de bodega. La ruta del día no puede ordenar las paradas por cercanía
          hasta capturarlas.
        </p>
      )}

      <form action={formAction} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="ubicacion" className="text-xs text-muted-foreground">
            Coordenadas o link de Google Maps
          </Label>
          <Input
            id="ubicacion"
            name="ubicacion"
            required
            placeholder="29.0729, -110.9559 o https://maps.app.goo.gl/…"
            className="h-11"
          />
        </div>
        <Mensaje state={state ?? quitado} />
        <div className="flex gap-2">
          <div className="flex-1">
            <Guardar texto="Guardar bodega" />
          </div>
          {bodega?.fuente === "bd" && (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={quitando}
              onClick={() =>
                startQuitar(async () => {
                  setQuitado(await quitarBodega());
                })
              }
            >
              Quitar
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
