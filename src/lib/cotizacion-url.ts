// URLs de la hoja de cotización (/api/cotizacion). Van aparte de
// lib/cotizacion.ts porque ese módulo es "server-only" y estas se arman en el
// formulario, que corre en el cliente.
//
// A la URL solo se le dice QUÉ se cotiza (unidades, fechas, domicilio,
// descuento); los precios los pone el servidor.

export type SeleccionUrl = {
  unidadIds: string[];
  fechaInicio: string; // yyyy-mm-dd
  fechaFin: string;
  costoDomicilio: number;
  distanciaKm?: number | null;
  descuentoMonto: number;
  cliente?: string | null;
};

export function urlCotizacionRenta(rentaId: string): string {
  return `/api/cotizacion?renta=${encodeURIComponent(rentaId)}`;
}

export function urlCotizacionSeleccion(sel: SeleccionUrl): string {
  const p = new URLSearchParams({
    u: sel.unidadIds.join(","),
    i: sel.fechaInicio,
    f: sel.fechaFin,
  });
  if (sel.costoDomicilio > 0) p.set("dom", String(sel.costoDomicilio));
  if (sel.distanciaKm) p.set("km", String(sel.distanciaKm));
  if (sel.descuentoMonto > 0) p.set("desc", String(sel.descuentoMonto));
  if (sel.cliente) p.set("cli", sel.cliente);
  return `/api/cotizacion?${p.toString()}`;
}
