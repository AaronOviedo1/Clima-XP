"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ClienteOpcion = { id: string; nombre: string; telefono: string | null };

// "Fernández" → "fernandez" para comparar sin acentos ni mayúsculas.
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const MAX_RESULTADOS = 50;

export function ClienteCombobox({
  clientes,
  value,
  onChange,
}: {
  clientes: ClienteOpcion[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");

  const seleccionado = clientes.find((c) => c.id === value);

  const filtrados = useMemo(() => {
    const q = normalizar(consulta.trim());
    if (!q) return clientes.slice(0, MAX_RESULTADOS);
    const digitos = consulta.replace(/\D/g, "");
    return clientes
      .filter(
        (c) =>
          normalizar(c.nombre).includes(q) ||
          (digitos.length >= 3 && c.telefono?.includes(digitos)),
      )
      .slice(0, MAX_RESULTADOS);
  }, [clientes, consulta]);

  return (
    <Popover
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) setConsulta("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          className="h-11 w-full min-w-0 flex-1 justify-between font-normal"
        >
          <span className={cn("truncate", !seleccionado && "text-muted-foreground")}>
            {seleccionado ? seleccionado.nombre : "Selecciona un cliente"}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Nombre o celular…"
            value={consulta}
            onValueChange={setConsulta}
          />
          <CommandList>
            <CommandEmpty>Sin coincidencias.</CommandEmpty>
            <CommandGroup>
              {filtrados.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    onChange(c.id);
                    setAbierto(false);
                  }}
                >
                  <Check
                    className={cn("size-4", c.id === value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                  {c.telefono && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {c.telefono.replace(/^\+52/, "")}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
