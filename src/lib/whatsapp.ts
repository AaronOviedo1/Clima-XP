// Mensajes que se le mandan al cliente por WhatsApp desde las tarjetas del día
// y el detalle de la renta. Viven aquí —y no en `avisos.ts`, que es el copy de
// las notificaciones push del equipo— para que el dashboard, la ruta y el
// detalle digan exactamente lo mismo.

import { linkWhatsApp } from "@/lib/telefono";

// El saludo depende de la hora del dispositivo, así que se arma en el momento
// del tap: calcularlo al renderizar lo dejaría congelado desde la hidratación
// (una tarjeta abierta desde la mañana seguiría diciendo "Buenos días").
function saludo(): string {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

/**
 * Cómo se le nombra al equipo de la renta: "el aerocooler", "los 3 calentones".
 * Cuando la renta lleva de los dos tipos se dice "los equipos" en vez de armar
 * una lista larga en un mensaje que se lee de pasada.
 */
export function nombreEquipos(tipos: string[], cantidad: number): string {
  const uno = cantidad <= 1;
  if (tipos.length !== 1) return uno ? "el equipo" : `los ${cantidad} equipos`;
  const aero = tipos[0] === "AEROCOOLER";
  if (uno) return aero ? "el aerocooler" : "el calentón";
  return `los ${cantidad} ${aero ? "aerocoolers" : "calentones"}`;
}

/** Van saliendo con el equipo hacia el cliente. */
export function mensajeEnRuta(): string {
  return `${saludo()}, ya van en camino a entregarle👍`;
}

/** Van saliendo a recoger el equipo que está con el cliente. */
export function mensajeRecoleccion(tipos: string[], cantidad: number): string {
  return `${saludo()}, ya van en camino por ${nombreEquipos(tipos, cantidad)}👍`;
}

/**
 * Abre WhatsApp con el mensaje precargado. Dispara el click de un `<a>` creado
 * al vuelo en lugar de `window.open`, que la PWA instalada en iOS bloquea en
 * silencio; así sigue contando como el gesto de click del usuario.
 * Devuelve false si el teléfono no sirve para `wa.me`.
 */
export function abrirWhatsApp(telefono: string | null | undefined, texto: string): boolean {
  const url = linkWhatsApp(telefono, texto);
  if (!url) return false;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
  return true;
}
