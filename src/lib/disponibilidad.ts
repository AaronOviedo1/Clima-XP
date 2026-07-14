import type { Prisma } from "@prisma/client";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";

// Estados que ocupan una unidad para su rango de fechas.
export const ESTADOS_ACTIVOS = ["CONFIRMADA", "EN_RUTA", "ENTREGADA"] as const;

/**
 * Condición de traslape contra el rango [inicio, fin) de una renta nueva.
 * La ocupación es fin-exclusiva: el día de recolección (fechaFin) la unidad
 * ya cuenta como libre para otra entrega. Una renta con entrega y recolección
 * el mismo día ocupa ese único día.
 */
function condicionTraslape(inicio: Date, fin: Date) {
  // Rango de un solo día: tratarlo como [inicio, inicio + 1).
  const finExclusivo = fin > inicio ? fin : addDays(inicio, 1);
  return {
    fechaInicio: { lt: finExclusivo },
    OR: [
      { fechaFin: { gt: inicio } },
      // Renta existente de un solo día que cae justo en el día de inicio.
      { fechaInicio: { gte: inicio }, fechaFin: { lte: inicio } },
    ],
  };
}

export type UnidadDisponible = Prisma.UnidadGetPayload<{
  include: { modelo: true };
}>;

/**
 * Unidades disponibles para el rango [inicio, fin):
 * - no en MANTENIMIENTO ni BAJA
 * - sin traslape con otra renta activa (ver condicionTraslape)
 *
 * `excluirRentaId` ignora la propia renta al editar.
 */
export async function unidadesDisponibles(
  inicio: Date,
  fin: Date,
  excluirRentaId?: string,
): Promise<UnidadDisponible[]> {
  return prisma.unidad.findMany({
    where: {
      estado: { notIn: ["MANTENIMIENTO", "BAJA"] },
      rentaItems: {
        none: {
          renta: {
            estado: { in: [...ESTADOS_ACTIVOS] },
            ...(excluirRentaId ? { id: { not: excluirRentaId } } : {}),
            ...condicionTraslape(inicio, fin),
          },
        },
      },
    },
    include: { modelo: true },
    orderBy: [{ modelo: { nombre: "asc" } }, { codigo: "asc" }],
  });
}

/**
 * Verifica que un conjunto de unidades siga disponible (para revalidar en la
 * transacción de creación/edición). Devuelve los códigos que ya NO lo están.
 */
export async function unidadesNoDisponibles(
  unidadIds: string[],
  inicio: Date,
  fin: Date,
  excluirRentaId?: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<string[]> {
  if (unidadIds.length === 0) return [];
  const ocupadas = await tx.unidad.findMany({
    where: {
      id: { in: unidadIds },
      OR: [
        { estado: { in: ["MANTENIMIENTO", "BAJA"] } },
        {
          rentaItems: {
            some: {
              renta: {
                estado: { in: [...ESTADOS_ACTIVOS] },
                ...(excluirRentaId ? { id: { not: excluirRentaId } } : {}),
                ...condicionTraslape(inicio, fin),
              },
            },
          },
        },
      ],
    },
    select: { codigo: true },
  });
  return ocupadas.map((u) => u.codigo);
}
