import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { definirTool } from "@/lib/copiloto/tool";
import { scopeNegocio } from "@/lib/copiloto/contexto";
import {
  ETIQUETA_ESTADO_UNIDAD,
  fechaInstante,
  unidadAccionSelect,
} from "@/lib/copiloto/acciones/unidad-comun";

const LIMITE_DEFAULT = 30;

export const argsBuscarUnidades = z.strictObject({
  codigo: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .optional()
    .describe("Código físico o parte de él ('CAL-05', 'EF')."),
  modelo: z.string().trim().min(2).max(40).optional().describe("Nombre del modelo o parte ('Eco-Fresco', 'Fire Sense')."),
  estado: z
    .enum(["DISPONIBLE", "RENTADA", "MANTENIMIENTO", "BAJA"])
    .optional()
    .describe("Solo unidades en ese estado."),
  limite: z.number().int().min(1).max(50).optional().describe("Cuántas devolver (1–50, default 30)."),
});

export type UnidadEncontrada = {
  unidadId: string;
  codigo: string;
  modelo: string;
  tipo: string;
  estado: string;
  estadoEtiqueta: string;
  reportesAbiertos: number;
  mantenimientoAbierto: {
    descripcion: string;
    costo: number | null;
    fecha: string; // ISO
    fechaEtiqueta: string;
  } | null;
};

export type UnidadesEncontradas = {
  coincidencias: number;
  truncado: boolean;
  unidades: UnidadEncontrada[];
};

/**
 * Unidades del inventario por código, modelo o estado, con su reporte de falla
 * abierto (para reportar o resolver). Sin `notas`. Solo admin, como /inventario.
 */
export const buscarUnidades = definirTool({
  nombre: "buscar_unidades",
  descripcion:
    "Lista unidades del inventario (código físico, modelo, estado y su reporte de falla abierto si lo hay) filtrando por código, modelo o estado. Úsala para '¿qué unidades están en mantenimiento?', '¿qué tiene el CAL-05?' o para confirmar un código antes de proponer un reporte de falla o resolverlo. Para saber cuánto equipo libre hay en unas fechas usa disponibilidad_equipos.",
  roles: ["ADMIN"],
  args: argsBuscarUnidades,
  async ejecutar(args, ctx) {
    const limite = args.limite ?? LIMITE_DEFAULT;
    const where: Prisma.UnidadWhereInput = {
      ...scopeNegocio(ctx),
      ...(args.codigo ? { codigo: { contains: args.codigo, mode: "insensitive" } } : {}),
      ...(args.modelo ? { modelo: { nombre: { contains: args.modelo, mode: "insensitive" } } } : {}),
      ...(args.estado ? { estado: args.estado } : {}),
    };
    const [coincidencias, filas] = await Promise.all([
      prisma.unidad.count({ where }),
      prisma.unidad.findMany({
        where,
        select: unidadAccionSelect,
        orderBy: [{ modelo: { nombre: "asc" } }, { codigo: "asc" }],
        take: limite,
      }),
    ]);
    const resultado: UnidadesEncontradas = {
      coincidencias,
      truncado: coincidencias > filas.length,
      unidades: filas.map((u) => {
        const m = u.mantenimientos[0];
        return {
          unidadId: u.id,
          codigo: u.codigo,
          modelo: u.modelo.nombre,
          tipo: u.modelo.tipo,
          estado: u.estado,
          estadoEtiqueta: ETIQUETA_ESTADO_UNIDAD[u.estado] ?? u.estado,
          reportesAbiertos: u.mantenimientos.length,
          mantenimientoAbierto: m
            ? { descripcion: m.descripcion, costo: m.costo, fecha: m.fecha.toISOString(), fechaEtiqueta: fechaInstante(m.fecha) }
            : null,
        };
      }),
    };
    return resultado;
  },
});
