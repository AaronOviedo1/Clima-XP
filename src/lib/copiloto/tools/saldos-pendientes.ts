import "server-only";
import { z } from "zod";
import { definirTool } from "@/lib/copiloto/tool";
import { scopeNegocio } from "@/lib/copiloto/contexto";
import { diasEntre } from "@/lib/copiloto/comunes";
import { saldosPendientes as saldosPendientesQuery } from "@/lib/dashboard";
import { fechaDesdeInput, fechaLarga, inputDesdeFecha } from "@/lib/fechas";
import type { EstadoRentaStr } from "@/lib/rentas";

const LIMITE_DEFAULT = 20;

export const argsSaldos = z.strictObject({
  limite: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Cuántas rentas listar (1–50, default 20). El total por cobrar siempre es sobre todas."),
  orden: z
    .enum(["saldo", "antiguedad"])
    .optional()
    .describe("'saldo': mayor saldo primero (default). 'antiguedad': entrega más antigua primero."),
});

export type SaldoPendiente = {
  rentaId: string;
  cliente: string;
  telefono: string | null;
  fechaInicio: string;
  fechaEtiqueta: string; // "sábado 22 de agosto 2026" — el modelo no deduce el día de la semana
  estado: EstadoRentaStr;
  total: number;
  pagado: number;
  saldo: number;
  diasDesdeEntrega: number; // negativo = todavía no se entrega
};

export type SaldosPendientes = {
  totalPorCobrar: number;
  cuantas: number;
  lista: SaldoPendiente[];
  truncado: boolean; // había más de `limite`: la lista no es todo, el total sí
};

export const saldosPendientes = definirTool({
  nombre: "saldos_pendientes",
  descripcion:
    "Cuentas por cobrar: rentas activas (confirmadas, en ruta, entregadas o recogidas) que todavía deben dinero, con cliente, teléfono, fecha de entrega, total, pagado y saldo; y la suma total por cobrar. No incluye cotizaciones ni canceladas. Úsala para '¿quién me debe?', '¿cuánto tengo por cobrar?', '¿qué saldos son más viejos?'.",
  roles: ["ADMIN"],
  args: argsSaldos,
  async ejecutar(args, ctx) {
    const limite = args.limite ?? LIMITE_DEFAULT;
    // La misma función del bloque "Saldos" del dashboard y del aviso de los
    // lunes: viene ordenada por fecha de entrega ascendente.
    const todas = await saldosPendientesQuery(300, scopeNegocio(ctx));

    const ordenadas =
      args.orden === "antiguedad" ? todas : [...todas].sort((a, b) => b.saldo - a.saldo);

    const resultado: SaldosPendientes = {
      totalPorCobrar: todas.reduce((a, x) => a + x.saldo, 0),
      cuantas: todas.length,
      lista: ordenadas.slice(0, limite).map((x) => {
        const fechaInicio = inputDesdeFecha(x.renta.fechaInicio);
        return {
          rentaId: x.renta.id,
          cliente: x.renta.cliente.nombre,
          telefono: x.renta.cliente.telefono,
          fechaInicio,
          fechaEtiqueta: fechaLarga(fechaDesdeInput(fechaInicio)),
          estado: x.renta.estado as EstadoRentaStr,
          total: x.total,
          pagado: x.total - x.saldo,
          saldo: x.saldo,
          diasDesdeEntrega: diasEntre(fechaInicio, ctx.hoy),
        };
      }),
      truncado: todas.length > limite,
    };
    return resultado;
  },
});
