import "server-only";

/**
 * Los endpoints de cron viven fuera del login (Vercel los llama sin cookies),
 * así que se autentican con CRON_SECRET: Vercel lo manda como
 * `Authorization: Bearer <CRON_SECRET>` cuando la variable existe en el proyecto.
 * Sin la variable, el endpoint queda cerrado en vez de abierto.
 */
export function autorizadoCron(req: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  return req.headers.get("authorization") === `Bearer ${secreto}`;
}
