import "server-only";

/**
 * Feature flags del copiloto. Se leen en el servidor (layout y route handlers):
 * apagado = no hay botón en la app y /api/copiloto contesta 404, así que
 * "apagado" significa que no existe, no que está escondido. Se prenden por
 * entorno (Vercel: Production/Preview por separado) sin redesplegar código.
 */
function prendido(valor: string | undefined): boolean {
  const v = valor?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "si" || v === "sí";
}

export function copilotoHabilitado(): boolean {
  return prendido(process.env.COPILOTO_HABILITADO);
}

/**
 * Acciones (escritura con confirmación). Flag aparte, y además exige el
 * general: apagado = las acciones no se anuncian al modelo ni se pueden
 * invocar en modo directo, y /api/copiloto/acciones contesta 404; el copiloto
 * se queda en solo lectura.
 */
export function accionesHabilitadas(): boolean {
  return copilotoHabilitado() && prendido(process.env.COPILOTO_ACCIONES_HABILITADAS);
}
