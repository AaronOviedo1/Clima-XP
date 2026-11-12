"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type ClienteOpcion = { id: string; nombre: string; telefono: string | null };

// "Fernández" → "fernandez" para comparar sin acentos ni mayúsculas.
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const MAX_RESULTADOS = 50;
// Lo que ocupa la ventana arriba de la lista (margen + título + buscador) y
// el aire que se deja abajo, para que la lista termine justo sobre el teclado.
const ALTO_CABECERA = 128;
const ALTO_MAXIMO_LISTA = 420;

/**
 * Alto disponible para la lista, siguiendo al teclado del teléfono.
 *
 * Antes era un Popover pegado al botón: con el teclado abierto Radix lo volteaba
 * hacia arriba y, como el botón queda a media pantalla, el buscador y los
 * primeros clientes se salían por arriba (tapados por la barra de estado). Ahora
 * es una ventana anclada arriba y la lista mide lo que deja libre el
 * `visualViewport` —el único alto que en iOS descuenta el teclado; `dvh` no—.
 */
function useAltoLista(activo: boolean): number {
  const [alto, setAlto] = useState(ALTO_MAXIMO_LISTA);
  useEffect(() => {
    if (!activo) return;
    const vv = window.visualViewport;
    const medir = () => {
      const visible = vv?.height ?? window.innerHeight;
      setAlto(Math.max(160, Math.min(ALTO_MAXIMO_LISTA, visible - ALTO_CABECERA - 16)));
    };
    medir();
    vv?.addEventListener("resize", medir);
    window.addEventListener("resize", medir);
    return () => {
      vv?.removeEventListener("resize", medir);
      window.removeEventListener("resize", medir);
    };
  }, [activo]);
  return alto;
}

export function ClienteCombobox({
  clientes,
  value,
  onChange,
  permitirSinCliente = false,
}: {
  clientes: ClienteOpcion[];
  value: string;
  onChange: (id: string) => void;
  // Ofrece "Sin cliente" (cotizaciones que se dan sin saber para quién son).
  permitirSinCliente?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const altoLista = useAltoLista(abierto);

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

  function elegir(id: string) {
    onChange(id);
    setAbierto(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={abierto}
        aria-haspopup="dialog"
        onClick={() => {
          setConsulta("");
          setAbierto(true);
        }}
        className="h-11 w-full min-w-0 flex-1 justify-between font-normal"
      >
        <span className={cn("truncate", !seleccionado && "text-muted-foreground")}>
          {seleccionado
            ? seleccionado.nombre
            : permitirSinCliente
              ? "Sin cliente (solo cotización)"
              : "Selecciona un cliente"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent
          showCloseButton={false}
          // Anclada arriba (no centrada): el teclado ocupa la mitad de abajo.
          className="top-3 max-w-[calc(100%-1.5rem)] translate-y-0 gap-0 overflow-hidden p-0 sm:top-[12%] sm:max-w-md"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <DialogTitle className="text-base font-bold">Elegir cliente</DialogTitle>
            <DialogDescription className="sr-only">
              Busca por nombre o celular.
            </DialogDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mr-2 size-9"
              onClick={() => setAbierto(false)}
            >
              <X className="size-5" />
              <span className="sr-only">Cerrar</span>
            </Button>
          </div>
          <Command shouldFilter={false} className="rounded-none bg-transparent">
            <div className="border-b px-3 pb-3">
              {/* 16px de letra: con menos, iOS hace zoom al enfocar. */}
              <CommandPrimitive.Input
                ref={inputRef}
                placeholder="Nombre o celular…"
                value={consulta}
                onValueChange={setConsulta}
                className="h-11 w-full rounded-lg border border-input bg-input/30 px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <CommandList style={{ maxHeight: altoLista }} className="overscroll-contain">
              <CommandEmpty>Sin coincidencias.</CommandEmpty>
              {permitirSinCliente && !consulta.trim() && (
                <CommandGroup>
                  <CommandItem
                    value="__sin_cliente__"
                    onSelect={() => elegir("")}
                    className="min-h-11 gap-3 px-3 text-[15px]"
                  >
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="flex-1">Sin cliente (solo cotización)</span>
                    {!value && <Check className="size-4" />}
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {filtrados.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => elegir(c.id)}
                    className="min-h-11 gap-3 px-3 text-[15px]"
                  >
                    <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                    {c.telefono && (
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {c.telefono.replace(/^\+52/, "")}
                      </span>
                    )}
                    <Check
                      className={cn("size-4 shrink-0", c.id === value ? "opacity-100" : "opacity-0")}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
