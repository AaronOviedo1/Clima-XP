import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Cliente comodín de las cotizaciones que se dan sin saber para quién son
 * (el precio se pide por teléfono y nadie da su nombre todavía).
 *
 * `Renta.clienteId` es NOT NULL y lo leen decenas de pantallas, así que en vez
 * de volver opcional la relación las cotizaciones anónimas cuelgan de este
 * único cliente. Reglas que lo rodean:
 * - No aparece en el directorio ni en el selector de clientes.
 * - Una cotización suya no se puede convertir en renta hasta asignarle un
 *   cliente de verdad (`cambiarEstadoRenta`).
 * - Se crea solo la primera vez que hace falta.
 *
 * Módulo neutro (sin "use server"): lo comparten actions y páginas.
 */
export const NOMBRE_SIN_CLIENTE = "Sin cliente (cotización)";

export function esClienteGenerico(c: { nombre: string; telefono?: string | null }): boolean {
  return c.nombre === NOMBRE_SIN_CLIENTE && !c.telefono;
}

/** `where` para dejar fuera al cliente comodín de una lista de clientes. */
export const SIN_CLIENTE_GENERICO: Prisma.ClienteWhereInput = {
  NOT: { nombre: NOMBRE_SIN_CLIENTE, telefono: null },
};

type Db = Pick<PrismaClient, "cliente"> | Prisma.TransactionClient;

export async function idClienteGenerico(db: Db): Promise<string> {
  const existente = await db.cliente.findFirst({
    where: { nombre: NOMBRE_SIN_CLIENTE, telefono: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (existente) return existente.id;
  const nuevo = await db.cliente.create({
    data: {
      nombre: NOMBRE_SIN_CLIENTE,
      notas: "Generado por la app: cotizaciones sin cliente asignado.",
    },
    select: { id: true },
  });
  return nuevo.id;
}
