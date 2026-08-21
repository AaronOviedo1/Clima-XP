import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ArgsInvalidos, definirTool } from "@/lib/copiloto/tool";
import { scopeNegocio } from "@/lib/copiloto/contexto";
import { fechaArg, recortar, textoEquipos } from "@/lib/copiloto/comunes";
import { rentaAccionSelect } from "@/lib/copiloto/acciones/renta-comun";
import {
  condicionBusquedaRentas,
  ESTADOS_RENTA,
  equiposPorModelo,
  totalesDeRenta,
  type EstadoRentaStr,
} from "@/lib/rentas";
import { fechaDesdeInput, fechaLarga, inputDesdeFecha } from "@/lib/fechas";

const LIMITE_DEFAULT = 10;
const LARGO_DIRECCION = 80;

export const argsBuscarRentas = z.strictObject({
  busqueda: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .optional()
    .describe("Nombre del cliente, teléfono, dirección o código de unidad (p. ej. 'Juan Pérez', '662 123 4567', 'EF-01')."),
  fecha: fechaArg
    .optional()
    .describe("Rentas que se entregan o se recogen ese día (yyyy-mm-dd)."),
  estado: z
    .enum(ESTADOS_RENTA)
    .optional()
    .describe("Solo rentas en ese estado (COTIZADA, CONFIRMADA, EN_RUTA, ENTREGADA, RECOGIDA, CONCLUIDA, CANCELADA)."),
  limite: z.number().int().min(1).max(20).optional().describe("Cuántas devolver (1–20, default 10)."),
});

export type RentaEncontrada = {
  rentaId: string;
  cliente: string;
  telefono: string | null;
  estado: EstadoRentaStr;
  fechaInicio: string;
  fechaInicioEtiqueta: string; // con día de la semana: el modelo no lo deduce
  fechaFin: string;
  fechaFinEtiqueta: string;
  equipos: string; // "2 × Eco-Fresco"
  codigos: string[];
  direccion: string;
  ventana: string | null;
  accesoriosEntregados: number;
  total?: number; // solo ADMIN
  pagado?: number;
  saldo?: number;
};

export type RentasEncontradas = {
  coincidencias: number;
  truncado: boolean;
  rentas: RentaEncontrada[];
};

/**
 * Localizar rentas concretas (para leer o para proponer una acción sobre ellas).
 * Misma búsqueda que la lista /rentas, sin las notas (nunca van al modelo).
 */
export const buscarRentas = definirTool({
  nombre: "buscar_rentas",
  descripcion:
    "Busca rentas por cliente (nombre o teléfono), dirección, código de unidad, fecha (entrega o recolección ese día) o estado, y devuelve sus datos con rentaId. Úsala para ubicar la renta exacta antes de proponer una acción ('la de Juan del sábado', 'la cotización de María', 'la renta del EF-03') o para responder por una renta concreta. Para 'qué hay hoy' usa resumen_operativo.",
  roles: ["ADMIN", "REPARTIDOR"],
  args: argsBuscarRentas,
  async ejecutar(args, ctx) {
    if (!args.busqueda && !args.fecha && !args.estado) {
      throw new ArgsInvalidos("Indica al menos busqueda, fecha o estado.");
    }
    const limite = args.limite ?? LIMITE_DEFAULT;
    const conDinero = ctx.rol === "ADMIN";
    const dia = args.fecha ? fechaDesdeInput(args.fecha) : null;

    const where: Prisma.RentaWhereInput = {
      ...scopeNegocio(ctx),
      AND: [
        ...(args.estado ? [{ estado: args.estado }] : []),
        ...(dia ? [{ OR: [{ fechaInicio: { equals: dia } }, { fechaFin: { equals: dia } }] }] : []),
        ...(args.busqueda ? [condicionBusquedaRentas(args.busqueda, { notas: false })] : []),
      ],
    };

    const [coincidencias, filas] = await Promise.all([
      prisma.renta.count({ where }),
      prisma.renta.findMany({
        relationLoadStrategy: "join",
        where,
        select: rentaAccionSelect,
        orderBy: [{ fechaInicio: "desc" }, { createdAt: "desc" }],
        take: limite,
      }),
    ]);

    const resultado: RentasEncontradas = {
      coincidencias,
      truncado: coincidencias > filas.length,
      rentas: filas.map((r) => {
        const inicio = inputDesdeFecha(r.fechaInicio);
        const fin = inputDesdeFecha(r.fechaFin);
        const base: RentaEncontrada = {
          rentaId: r.id,
          cliente: r.cliente.nombre,
          telefono: r.cliente.telefono,
          estado: r.estado as EstadoRentaStr,
          fechaInicio: inicio,
          fechaInicioEtiqueta: fechaLarga(fechaDesdeInput(inicio)),
          fechaFin: fin,
          fechaFinEtiqueta: fechaLarga(fechaDesdeInput(fin)),
          equipos: textoEquipos(equiposPorModelo(r.unidades)),
          codigos: r.unidades.map((u) => u.unidad.codigo),
          direccion: recortar(r.direccion, LARGO_DIRECCION),
          ventana: r.ventanaEntrega,
          accesoriosEntregados: r.accesorios.length,
        };
        if (!conDinero) return base;
        const t = totalesDeRenta(r);
        return { ...base, total: t.total, pagado: t.pagadoConfirmado, saldo: t.saldo };
      }),
    };
    return resultado;
  },
});
