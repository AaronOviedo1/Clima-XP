import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Estados que ocupan una unidad para su rango de fechas.
export const ESTADOS_ACTIVOS = ["CONFIRMADA", "EN_RUTA", "ENTREGADA"] as const;

export type UnidadDisponible = Prisma.UnidadGetPayload<{
  include: { modelo: true };
}>;

/**
 * Unidades disponibles para el rango [inicio, fin]:
 * - no en MANTENIMIENTO ni BAJA
 * - sin traslape con otra renta activa (regla del plan):
 *   existente.fechaInicio <= nueva.fechaFin  AND  existente.fechaFin >= nueva.fechaInicio
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
            fechaInicio: { lte: fin },
            fechaFin: { gte: inicio },
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
                fechaInicio: { lte: fin },
                fechaFin: { gte: inicio },
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
