"use client";

import { useState, useTransition } from "react";
import { crearClienteRapido } from "@/lib/actions/clientes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CANALES = [
  { v: "WHATSAPP", l: "WhatsApp" },
  { v: "MESSENGER", l: "Messenger" },
  { v: "RECOMENDACION", l: "Recomendación" },
  { v: "RECURRENTE", l: "Recurrente" },
  { v: "OTRO", l: "Otro" },
];

type ClienteCreado = { id: string; nombre: string; telefono: string | null };

export function ClienteRapidoDialog({
  onCreado,
}: {
  onCreado: (cliente: ClienteCreado) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [canal, setCanal] = useState("WHATSAPP");
  const [error, setError] = useState<string | null>(null);
  const [duplicado, setDuplicado] = useState<ClienteCreado | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setNombre("");
    setTelefono("");
    setCanal("WHATSAPP");
    setError(null);
    setDuplicado(null);
  }

  function terminar(cliente: ClienteCreado) {
    onCreado(cliente);
    setAbierto(false);
    reset();
  }

  function onGuardar(forzar: boolean) {
    setError(null);
    if (!nombre.trim()) return setError("El nombre es obligatorio.");
    startTransition(async () => {
      const res = await crearClienteRapido({
        nombre,
        telefono: telefono || null,
        canalOrigen: canal,
        forzar,
      });
      if ("error" in res) setError(res.error);
      else if ("duplicado" in res) setDuplicado(res.duplicado);
      else terminar(res.cliente);
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-11 shrink-0">
          + Nuevo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cr-nombre">Nombre</Label>
            <Input
              id="cr-nombre"
              value={nombre}
              className="h-11"
              autoComplete="name"
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cr-telefono">Teléfono</Label>
            <Input
              id="cr-telefono"
              type="tel"
              inputMode="tel"
              placeholder="662 123 4567"
              value={telefono}
              className="h-11"
              autoComplete="tel"
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cr-canal">Canal de origen</Label>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger id="cr-canal" className="h-11 w-full">
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          {duplicado ? (
            <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p>
                Ya existe un cliente con ese teléfono:{" "}
                <span className="font-medium">{duplicado.nombre}</span>.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => terminar(duplicado)}
                >
                  Usar ese cliente
                </Button>
                <Button
                  type="button"
                  className="h-11"
                  disabled={pending}
                  onClick={() => onGuardar(true)}
                >
                  Crear de todos modos
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              className="h-11 w-full text-base"
              disabled={pending}
              onClick={() => onGuardar(false)}
            >
              {pending ? "Guardando…" : "Crear cliente"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
