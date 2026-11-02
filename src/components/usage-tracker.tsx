"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { logScreenViewAction } from "@/lib/actions/uso";
import { PANTALLA_EVENT, pantallaDeRuta } from "@/lib/pantallas";

/**
 * Mide qué pantallas se abren, para el panel pasta-stats. Cuenta cada cambio
 * de ruta (también el pop-up interceptado de editar renta, que cambia la URL)
 * y cada sub-pantalla que una vista anuncie con `marcarPantalla()`. No pinta
 * nada.
 *
 * Va ANTES del contenido en el layout: React corre los efectos de hermanos en
 * orden, así el listener ya existe cuando una vista anuncia algo al montarse.
 */
export function UsageTracker() {
  const pathname = usePathname();
  const ultima = useRef<string | null>(null);

  useEffect(() => {
    const onPantalla = (event: Event) =>
      registrar(ultima, (event as CustomEvent<string>).detail);
    window.addEventListener(PANTALLA_EVENT, onPantalla);
    return () => window.removeEventListener(PANTALLA_EVENT, onPantalla);
  }, []);

  useEffect(() => {
    // Ruta nueva: abrir otra renta en la misma pestaña también cuenta.
    ultima.current = null;
    registrar(ultima, pantallaDeRuta(pathname));
  }, [pathname]);

  return null;
}

function registrar(
  ultima: { current: string | null },
  pantalla: string | null
) {
  if (!pantalla || pantalla === ultima.current) return;
  ultima.current = pantalla;
  void logScreenViewAction(pantalla).catch(() => {});
}
