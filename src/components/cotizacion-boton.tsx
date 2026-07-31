"use client";

import { useState } from "react";
import { FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CotizacionCompartir } from "@/components/cotizacion-compartir";

// Abre la hoja de cotización de una renta (detalle de renta). La imagen la
// genera /api/cotizacion; aquí solo se le dice de qué renta es.
export function CotizacionBoton({ rentaId, cliente }: { rentaId: string; cliente: string }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        className="h-12 w-full text-[15px] font-bold"
        onClick={() => setAbierto(true)}
      >
        <FileImage className="size-[18px]" /> Ver cotización
      </Button>
      <CotizacionCompartir
        url={`/api/cotizacion?renta=${encodeURIComponent(rentaId)}`}
        nombre={`Cotizacion-${cliente.replace(/[^\p{L}\p{N}]+/gu, "-")}`}
        abierto={abierto}
        onOpenChange={setAbierto}
      />
    </>
  );
}
