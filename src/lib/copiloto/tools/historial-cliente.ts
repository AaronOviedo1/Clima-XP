import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { definirTool } from "@/lib/copiloto/tool";
import { scopeNegocio } from "@/lib/copiloto/contexto";
import { textoEquipos } from "@/lib/copiloto/comunes";
import { equiposPorModelo, rentaListSelect, totalesDeRenta, type EstadoRentaStr } from "@/lib/rentas";
import { fechaDesdeInput, fechaLarga, inputDesdeFecha } from "@/lib/fechas";

const MAX_CLIENTES = 5;
const RENTAS_RECIENTES = 5;

export const argsHistorial = z.strictObject({
  busqueda: z
    .string()
    .trim()
    .min(2, "Escribe al menos 2 caracteres del nombre o del teléfono.")
    .max(60)
    .describe("Nombre (o parte del nombre) o teléfono del cliente."),
});

export type RentaDeCliente = {
  rentaId: string;
  fechaInicio: string;
  fechaEtiqueta: string; // "sábado 10 de enero 2026"
  fechaFin: string;
  estado: EstadoRentaStr;
  equipos: string;
  total: number;
  saldo: number;
};

export type ClienteHistorial = {
  clienteId: string;
  nombre: string;
  telefono: string | null;
  canal: string;
  numRentas: number;
  primeraRenta: string | null; // fecha de entrega de la más antigua ("cliente desde")
  primeraRentaEtiqueta: string | null;
  ultimaRenta: string | null;
  ultimaRentaEtiqueta: string | null;
  totalPagadoHistorico: number;
  saldoActual: number; // lo que debe hoy, sumando sus rentas
  equiposQueHaRentado: string[];
  rentasRecientes: RentaDeCliente[]; // las últimas 5, de la más reciente a la más antigua
};

export type HistorialCliente = {
  coincidencias: number; // cuántos clientes coinciden en total
  clientes: ClienteHistorial[]; // máx. 5
  truncado: boolean;
};

export const historialCliente = definirTool({
  nombre: "historial_cliente",
  descripcion:
    "Busca clientes por nombre o teléfono y devuelve su historial: cuántas veces han rentado, primera y última renta, total pagado, saldo actual, qué equipos han rentado y sus últimas 5 rentas. Úsala para '¿cuántas veces ha rentado X?', '¿cuándo fue la última de X?', '¿este teléfono ya nos había rentado?'. No incluye las notas del cliente.",
  roles: ["ADMIN"],
  args: argsHistorial,
  async ejecutar({ busqueda }, ctx) {
    // Mismo criterio que la búsqueda de /clientes y /rentas: nombre sin
    // mayúsculas, y teléfono por dígitos (se guarda E.164: "+52662…").
    const digitos = busqueda.replace(/\D/g, "");
    const where: Prisma.ClienteWhereInput = {
      ...scopeNegocio(ctx),
      OR: [
        { nombre: { contains: busqueda, mode: "insensitive" } },
        ...(digitos.length >= 4 ? [{ telefono: { contains: digitos } }] : []),
      ],
    };

    const [coincidencias, clientes] = await Promise.all([
      prisma.cliente.count({ where }),
      prisma.cliente.findMany({
        relationLoadStrategy: "join",
        where,
        select: {
          id: true,
          nombre: true,
          telefono: true,
          canalOrigen: true,
          _count: { select: { rentas: true } },
          rentas: { select: rentaListSelect, orderBy: { fechaInicio: "desc" } },
        },
        orderBy: { nombre: "asc" },
        take: MAX_CLIENTES,
      }),
    ]);

    const resultado: HistorialCliente = {
      coincidencias,
      truncado: coincidencias > clientes.length,
      clientes: clientes.map((c) => {
        const totales = c.rentas.map(totalesDeRenta);
        const fechas = c.rentas.map((r) => inputDesdeFecha(r.fechaInicio)); // desc
        const equipos = new Set<string>();
        for (const r of c.rentas) for (const u of r.unidades) equipos.add(u.unidad.modelo.nombre);
        return {
          clienteId: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          canal: c.canalOrigen,
          numRentas: c._count.rentas,
          primeraRenta: fechas.at(-1) ?? null,
          primeraRentaEtiqueta: fechas.length ? fechaLarga(fechaDesdeInput(fechas.at(-1)!)) : null,
          ultimaRenta: fechas[0] ?? null,
          ultimaRentaEtiqueta: fechas.length ? fechaLarga(fechaDesdeInput(fechas[0])) : null,
          totalPagadoHistorico: totales.reduce((a, t) => a + t.pagadoConfirmado, 0),
          saldoActual: totales.reduce((a, t) => a + Math.max(0, t.saldo), 0),
          equiposQueHaRentado: [...equipos].sort(),
          rentasRecientes: c.rentas.slice(0, RENTAS_RECIENTES).map((r, i) => ({
            rentaId: r.id,
            fechaInicio: fechas[i],
            fechaEtiqueta: fechaLarga(fechaDesdeInput(fechas[i])),
            fechaFin: inputDesdeFecha(r.fechaFin),
            estado: r.estado as EstadoRentaStr,
            equipos: textoEquipos(equiposPorModelo(r.unidades)),
            total: totales[i].total,
            saldo: totales[i].saldo,
          })),
        };
      }),
    };
    return resultado;
  },
});
