"use client";

import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type Hoja = { archivo: File; vistaPrevia: string };

/**
 * Vista previa de la hoja de cotización con opción de mandarla.
 *
 * El archivo se baja en cuanto se abre el diálogo, ANTES de que el usuario
 * toque "Compartir": Safari consume el gesto del usuario al cruzar un `await`,
 * así que un `navigator.share` después de un `fetch` truena en el iPhone con
 * NotAllowedError. Con el File ya listo, el share sale del mismo tick del tap y
 * iOS lo acepta.
 *
 * `wa.me` no puede adjuntar archivos: la imagen llega a WhatsApp por la hoja de
 * compartir del sistema, por eso el botón dice "Compartir" y no "WhatsApp".
 */
export function CotizacionCompartir({
  url,
  nombre = "Cotizacion",
  abierto,
  onOpenChange,
}: {
  url: string;
  nombre?: string;
  abierto: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
        <DialogTitle>Cotización</DialogTitle>
        {/* El contenido se monta con la URL como key: cada hoja arranca de cero
            y no hay que reiniciar estado a mano. */}
        {abierto && <Contenido key={url} url={url} nombre={nombre} />}
      </DialogContent>
    </Dialog>
  );
}

function Contenido({ url, nombre }: { url: string; nombre: string }) {
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    let creada: string | null = null;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo generar la cotización.");
        return r.blob();
      })
      .then((blob) => {
        if (!vivo) return;
        creada = URL.createObjectURL(blob);
        setHoja({
          archivo: new File([blob], `${nombre}.png`, { type: "image/png" }),
          vistaPrevia: creada,
        });
      })
      .catch((e) => {
        if (!vivo) return;
        setError(e instanceof Error ? e.message : "No se pudo generar la cotización.");
      });

    return () => {
      vivo = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [url, nombre]);

  // Descarga (escritorio, y respaldo cuando el sistema no comparte archivos):
  // el <a> creado al vuelo es lo único que funciona dentro de la PWA de iOS.
  function descargar() {
    const a = document.createElement("a");
    a.href = hoja?.vistaPrevia ?? url;
    a.download = `${nombre}.png`;
    a.click();
  }

  function compartir() {
    if (!hoja) return;
    const archivos = [hoja.archivo];
    if (!navigator.canShare?.({ files: archivos })) {
      descargar();
      return;
    }
    // Sin await antes del share: iOS exige que salga del propio gesto.
    navigator.share({ files: archivos }).catch((e: unknown) => {
      // Cerrar la hoja de compartir lanza AbortError; eso no es un error.
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error("No se pudo compartir; se descargó la imagen.");
      descargar();
    });
  }

  return (
    <>
      <div className="max-h-[55vh] overflow-y-auto rounded-xl border">
        {error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : hoja ? (
          // Se muestra el blob ya descargado: no se pide la imagen dos veces.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hoja.vistaPrevia} alt="Hoja de cotización" className="w-full" />
        ) : (
          <Skeleton className="h-[380px] w-full" />
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1" onClick={descargar} disabled={!hoja}>
          <Download className="size-4" /> Descargar
        </Button>
        <Button className="h-11 flex-1" onClick={compartir} disabled={!hoja}>
          <Share2 className="size-4" /> Compartir
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Compartir abre las apps del teléfono: elige WhatsApp y el contacto.
      </p>
    </>
  );
}
