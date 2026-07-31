"use client";

import { useState } from "react";
import { FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CotizacionCompartir } from "@/components/cotizacion-compartir";
import { urlCotizacionRenta } from "@/lib/cotizacion-url";

// Abre la hoja de cotización de una renta guardada (detalle de renta).
export function CotizacionBoton({ rentaId, cliente }: { rentaId: string; cliente: string }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        className="h-12 w-full text-[15px] font-bold"
        onClick={() => setAbierto(true)}
      >
        <FileImage className="size-[18px]" /> Compartir cotización
      </Button>
      <CotizacionCompartir
        url={urlCotizacionRenta(rentaId)}
        nombre={`Cotizacion-${cliente.replace(/[^\p{L}\p{N}]+/gu, "-")}`}
        abierto={abierto}
        onOpenChange={setAbierto}
      />
    </>
  );
}
