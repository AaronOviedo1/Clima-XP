"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ClienteFormState } from "@/lib/actions/clientes";
import { Button } from "@/components/ui/button";
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

type Accion = (
  prev: ClienteFormState,
  fd: FormData,
) => Promise<ClienteFormState>;

export type ClienteInicial = {
  nombre: string;
  telefono: string | null;
  canalOrigen: string;
  notas: string | null;
};

const CANALES = [
  { v: "WHATSAPP", l: "WhatsApp" },
  { v: "MESSENGER", l: "Messenger" },
  { v: "RECOMENDACION", l: "Recomendación" },
  { v: "RECURRENTE", l: "Recurrente" },
  { v: "OTRO", l: "Otro" },
];

function Guardar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
      {pending ? "Guardando…" : texto}
    </Button>
  );
}

export function ClienteForm({
  accion,
  inicial,
  textoBoton = "Guardar",
}: {
  accion: Accion;
  inicial?: ClienteInicial;
  textoBoton?: string;
}) {
  const [state, formAction] = useActionState<ClienteFormState, FormData>(
    accion,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre</Label>
        <Input
          id="nombre"
          name="nombre"
          required
          defaultValue={inicial?.nombre}
          className="h-11"
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input
          id="telefono"
          name="telefono"
          type="tel"
          inputMode="tel"
          placeholder="662 123 4567"
          defaultValue={inicial?.telefono ?? ""}
          className="h-11"
          autoComplete="tel"
        />
        <p className="text-xs text-muted-foreground">
          Se guarda normalizado (+52…). Detecta clientes repetidos.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="canalOrigen">Canal de origen</Label>
        <Select name="canalOrigen" defaultValue={inicial?.canalOrigen ?? "WHATSAPP"}>
          <SelectTrigger id="canalOrigen" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CANALES.map((c) => (
              <SelectItem key={c.v} value={c.v}>
                {c.l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          name="notas"
          rows={3}
          defaultValue={inicial?.notas ?? ""}
          placeholder="Referencias, preferencias, etc."
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      {state?.duplicado && (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p>
            Ya existe un cliente con ese teléfono:{" "}
            <Link
              href={`/clientes/${state.duplicado.id}`}
              className="font-medium underline"
            >
              {state.duplicado.nombre}
            </Link>
            .
          </p>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="forzar" value="1" className="size-4" />
            Crear de todos modos
          </label>
        </div>
      )}

      <Guardar texto={textoBoton} />
    </form>
  );
}
