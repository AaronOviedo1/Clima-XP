"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { embedPuntoMaps, linkMapsPunto } from "@/lib/maps";
import { cn } from "@/lib/utils";

/**
 * Mapa del punto que Google resolvió para la dirección, para confirmarlo a ojo
 * antes de guardar: la sugerencia elegida puede ser la calle correcta con el
 * número equivocado, y el repartidor se entera hasta que está afuera.
 *
 * Va por `<iframe>` con el embed clásico (`output=embed`), igual que la ruta
 * del día: no necesita API key en el cliente —así no hay que exponer la del
 * negocio— ni gasta cargas facturables de la Maps JavaScript API.
 */
export function MapaPunto({
  direccion,
  lat,
  lng,
  recalculando,
}: {
  direccion: string;
  lat: number | null;
  lng: number | null;
  recalculando?: boolean;
}) {
  const src = lat != null && lng != null ? embedPuntoMaps(lat, lng) : null;
  if (!src) return null;

  return (
    <div className={cn("space-y-1.5 transition-opacity", recalculando && "opacity-50")}>
      {/* `key` por punto: cada ubicación nueva remonta el marco y el mapa
          vuelve a quedar dormido. Sin eso, el que ya estaba activo se llevaba
          el siguiente scroll. */}
      <MarcoMapa key={src} src={src} />
      <p className="flex items-start justify-between gap-3 text-[12.5px] text-tenue">
        <span>Confirma que el pin caiga en el domicilio.</span>
        <a
          href={linkMapsPunto(direccion, lat, lng)}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 font-medium text-medio underline"
        >
          Abrir en Maps
          <ExternalLink className="size-3" />
        </a>
      </p>
    </div>
  );
}

// El mapa arranca "dormido": en el teléfono, arrastrar sobre un iframe de
// Google mueve el mapa y no la página, y este formulario es todo scroll. Con la
// capa encima el primer gesto sigue siendo scroll, y quien quiera mover el mapa
// lo toca una vez.
function MarcoMapa({ src }: { src: string }) {
  const [activo, setActivo] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-xl border border-linea">
      <iframe
        src={src}
        title="Ubicación de la dirección en el mapa"
        className="block h-44 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      {!activo && (
        <button
          type="button"
          onClick={() => setActivo(true)}
          aria-label="Activar el mapa para moverlo"
          className="absolute inset-0 flex items-end justify-center bg-transparent pb-2"
        >
          <span className="rounded-full bg-black/55 px-3 py-1 text-[11.5px] font-medium text-white">
            Toca para mover el mapa
          </span>
        </button>
      )}
    </div>
  );
}
