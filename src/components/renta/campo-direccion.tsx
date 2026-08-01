"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { RentaFormApi } from "@/hooks/use-renta-form";
import { sugerenciasDireccion } from "@/lib/actions/rentas";
import type { SugerenciaDireccion } from "@/lib/google-maps";
import { esLinkCortoMaps, esUrl, parseCoordenadas } from "@/lib/coordenadas";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ¿Lo escrito o pegado es un link de Maps / coordenadas? Entonces no se buscan
// sugerencias: se resuelve como ubicación.
function pareceUbicacion(texto: string): boolean {
  return esUrl(texto) || esLinkCortoMaps(texto) || parseCoordenadas(texto) != null;
}

// Valor que tendría el campo después de pegar, para poder resolverlo sin
// esperar al re-render (el state todavía no refleja el pegado).
function valorAlPegar(e: React.ClipboardEvent<HTMLTextAreaElement>): string | null {
  const pegado = e.clipboardData.getData("text");
  if (!pegado.trim()) return null;
  const el = e.currentTarget;
  const desde = el.selectionStart ?? el.value.length;
  const hasta = el.selectionEnd ?? el.value.length;
  e.preventDefault();
  return el.value.slice(0, desde) + pegado + el.value.slice(hasta);
}

/**
 * Dirección con sugerencias de Google mientras se escribe, y que también
 * acepta que le peguen un link de Maps o coordenadas (antes eso era un campo
 * aparte). Al pegar un link, la dirección legible reemplaza a la URL.
 */
export function CampoDireccion({ form, opcional }: { form: RentaFormApi; opcional?: boolean }) {
  const [sugerencias, setSugerencias] = useState<SugerenciaDireccion[]>([]);
  const [buscando, setBuscando] = useState(false);
  // Lo último que se eligió/pegó: evita volver a sugerir sobre ese mismo texto
  // (si no, al elegir una sugerencia el menú se abre de nuevo con ella dentro).
  const yaResuelto = useRef<string | null>(null);

  useEffect(() => {
    const texto = form.direccion.trim();
    if (texto === yaResuelto.current || texto.length < 4 || pareceUbicacion(texto)) {
      setSugerencias([]);
      return;
    }
    // Se espera a que deje de escribir: una llamada por palabra, no por letra.
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      const res = await sugerenciasDireccion(texto);
      if (!vivo) return;
      setSugerencias(res);
      setBuscando(false);
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
      setBuscando(false);
    };
  }, [form.direccion]);

  function elegir(s: SugerenciaDireccion) {
    yaResuelto.current = [s.descripcion, s.detalle].filter(Boolean).join(", ").trim();
    setSugerencias([]);
    form.elegirSugerencia(s);
  }

  return (
    <section className="space-y-2">
      <Label htmlFor="dir">Dirección{opcional && " (opcional al cotizar)"}</Label>
      <Textarea
        id="dir"
        value={form.direccion}
        rows={2}
        autoCapitalize="sentences"
        autoComplete="off"
        placeholder="Escribe la calle y elige de la lista, o pega el link de Maps"
        onChange={(e) => form.setDireccion(e.target.value)}
        onPaste={(e) => {
          const v = valorAlPegar(e);
          if (v == null) return;
          if (pareceUbicacion(v)) {
            yaResuelto.current = v;
            form.pegarUbicacion(v);
          } else {
            form.setDireccion(v);
          }
        }}
      />

      {(sugerencias.length > 0 || buscando) && (
        <ul className="overflow-hidden rounded-xl border border-linea bg-card">
          {buscando && sugerencias.length === 0 && (
            <li className="px-4 py-3 text-[13px] text-tenue">Buscando direcciones…</li>
          )}
          {sugerencias.map((s) => (
            <li key={(s.placeId ?? s.descripcion) + (s.detalle ?? "")}>
              <button
                type="button"
                onClick={() => elegir(s)}
                className="flex w-full items-center gap-3 border-b border-linea px-4 py-3 text-left last:border-b-0 active:bg-superficie-hover"
              >
                <MapPin className="size-4 shrink-0 text-tenue" />
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-semibold">
                    {s.descripcion}
                  </span>
                  {s.detalle && (
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {s.detalle}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {form.ubicando && (
        <p className="text-[12.5px] text-muted-foreground">Calculando distancia desde la bodega…</p>
      )}
    </section>
  );
}
