import "server-only";

/**
 * Feature flag del copiloto. Se lee en el servidor (layout y route handler):
 * apagado = no hay botón en la app y /api/copiloto contesta 404, así que
 * "apagado" significa que no existe, no que está escondido. Se prende por
 * entorno (Vercel: Production/Preview por separado) sin redesplegar código.
 */
export function copilotoHabilitado(): boolean {
  const v = process.env.COPILOTO_HABILITADO?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "si" || v === "sí";
}
