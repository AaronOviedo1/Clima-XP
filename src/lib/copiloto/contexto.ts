import "server-only";
import type { Rol } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hoyNegocio } from "@/lib/fechas";

/**
 * Con qué corre toda consulta del copiloto. Se construye ÚNICAMENTE en
 * `contextoDesdeSesion()` a partir de la sesión: el modelo nunca lo ve, y
 * ninguna tool acepta nada parecido (userId, rol, negocio) entre sus args.
 */
export type ContextoCopiloto = {
  userId: string;
  rol: Rol;
  // "yyyy-mm-dd" en la zona del negocio: el modelo no sabe qué día es en
  // Hermosillo, y "hoy"/"mañana" se resuelven contra esto, nunca contra el reloj
  // del modelo ni el del navegador.
  hoy: string;
};

/**
 * Scope de tenant: TODAS las queries de las tools hacen spread de esto en su
 * `where`. Hoy el sistema es de un solo negocio (no hay negocioId en el schema),
 * así que es `{}`; si algún día existe, se llena aquí y ninguna query se queda
 * sin él. Por eso se pasa `ctx` aunque todavía no se use.
 */
export type ScopeNegocio = Record<never, never>;

export function scopeNegocio(ctx: ContextoCopiloto): ScopeNegocio {
  void ctx;
  return {};
}

const ROLES: readonly Rol[] = ["ADMIN", "REPARTIDOR"];

/**
 * Sesión real o nada. A propósito NO mira AUTH_HABILITADA ni cae a
 * USUARIO_POR_DEFECTO: con el login apagado las páginas asumen un admin
 * ficticio, pero el copiloto no responde sin saber quién pregunta.
 *
 * El rol se lee de la BD, no del JWT: el token lo trae congelado hasta que la
 * sesión expira, y aquí hay tools que solo el admin puede ver. Es una query por
 * consulta; también cubre al usuario borrado con sesión viva.
 */
export async function contextoDesdeSesion(): Promise<ContextoCopiloto | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const usuario = await prisma.user.findUnique({ where: { id }, select: { rol: true } });
  if (!usuario || !ROLES.includes(usuario.rol)) return null;
  return { userId: id, rol: usuario.rol, hoy: hoyNegocio() };
}
