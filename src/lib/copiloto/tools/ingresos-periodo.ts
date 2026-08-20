import "server-only";
import { z } from "zod";
import { definirTool } from "@/lib/copiloto/tool";
import { scopeNegocio } from "@/lib/copiloto/contexto";
import { fechaArg } from "@/lib/copiloto/comunes";
import { generarReportes, type PeriodoReporte } from "@/lib/reportes";
import { claveSemana, fechaDesdeInput } from "@/lib/fechas";

// Es la tool más pesada en tokens: la serie y el top de clientes solo van si se
// piden, y la serie se topa.
const MAX_PUNTOS_SERIE = 12;
const TOP_CLIENTES = 5;

export const argsIngresos = z
  .strictObject({
    anio: z.number().int().min(2000).max(2100).optional().describe("Año, p. ej. 2026. Sin año: todo el histórico."),
    mes: z.number().int().min(1).max(12).optional().describe("Mes 1–12 (requiere anio)."),
    semana: fechaArg
      .optional()
      .describe(
        "Cualquier día de la semana deseada (yyyy-mm-dd); se toma su semana lunes–domingo completa (requiere anio y mes).",
      ),
    incluirSerie: z
      .boolean()
      .optional()
      .describe(
        "Incluir la serie de ingresos por sub-periodo (histórico→años, año→meses, mes→semanas, semana→días), máx. 12 puntos. Default false.",
      ),
    incluirTopClientes: z
      .boolean()
      .optional()
      .describe("Incluir los 5 clientes con más ingreso cobrado en el periodo. Default false."),
  })
  .refine((a) => a.mes == null || a.anio != null, {
    message: "Para filtrar por mes hay que indicar el año.",
    path: ["mes"],
  })
  .refine((a) => a.semana == null || (a.anio != null && a.mes != null), {
    message: "Para filtrar por semana hay que indicar año y mes.",
    path: ["semana"],
  });

export type IngresosPeriodo = {
  periodo: string; // "Agosto 2026", "2026", "Histórico", "3 – 9 ago 2026"
  nivel: "historico" | "anio" | "mes" | "semana";
  kpis: {
    cobrado: number; // pagos confirmados recibidos (lo que entró)
    facturado: number; // suma de los totales de las rentas del periodo (lo vendido, cobrado o no)
    porCobrar: number; // saldo pendiente de las rentas activas del periodo
    numRentas: number;
    ticketPromedio: number; // cobrado / numRentas
  };
  tendencia: { pct: number; vs: string } | null; // facturado vs el periodo anterior del mismo tamaño
  porTipo: {
    aerocooler: { ingresoEquipo: number; rentas: number };
    calenton: { ingresoEquipo: number; rentas: number };
  };
  porMetodo: { metodo: string; monto: number }[];
  periodosConRentas: { anios: number[]; meses?: number[]; semanas?: string[] };
  serie?: { titulo: string; puntos: { etiqueta: string; monto: number }[] };
  topClientes?: { cliente: string; monto: number }[];
};

export const ingresosPeriodo = definirTool({
  nombre: "ingresos_periodo",
  descripcion:
    "Ingresos y ventas de un periodo (todo el histórico, un año, un mes o una semana), los mismos números de la pantalla de Reportes. Glosario: 'cobrado' = pagos confirmados recibidos; 'facturado' = suma de los totales de las rentas del periodo (lo vendido, se haya cobrado o no); 'porCobrar' = saldo pendiente de las rentas activas del periodo; 'ticketPromedio' = cobrado entre número de rentas. Incluye tendencia contra el periodo anterior, desglose aerocooler/calentón y por método de pago. La serie por sub-periodo y el top de clientes solo si se piden. Úsala para '¿cuánto vendí en julio?', '¿cómo va el año contra el pasado?', '¿qué método de pago usan más?'.",
  roles: ["ADMIN"],
  args: argsIngresos,
  async ejecutar(args, ctx) {
    // Jerárquico como en /reportes: sin año no hay mes, sin mes no hay semana
    // (el schema ya lo exige; aquí solo se arma). La semana se normaliza a su lunes.
    const periodo: PeriodoReporte = {
      anio: args.anio ?? null,
      mes: args.anio != null ? (args.mes ?? null) : null,
      semana:
        args.anio != null && args.mes != null && args.semana
          ? claveSemana(fechaDesdeInput(args.semana))
          : null,
    };
    const rep = await generarReportes(periodo, scopeNegocio(ctx));

    const nivel = periodo.semana
      ? "semana"
      : periodo.mes != null
        ? "mes"
        : periodo.anio != null
          ? "anio"
          : "historico";

    const resultado: IngresosPeriodo = {
      periodo: rep.etiqueta,
      nivel,
      kpis: {
        cobrado: rep.kpis.ingresos,
        facturado: rep.kpis.facturado,
        porCobrar: rep.kpis.porCobrar,
        numRentas: rep.kpis.numRentas,
        ticketPromedio: rep.kpis.ticketPromedio,
      },
      tendencia: rep.tendencia.mostrar ? { pct: rep.tendencia.pct, vs: rep.tendencia.label } : null,
      porTipo: {
        aerocooler: { ingresoEquipo: rep.porTipo.aerocooler, rentas: rep.porTipo.rentasAero },
        calenton: { ingresoEquipo: rep.porTipo.calenton, rentas: rep.porTipo.rentasCal },
      },
      porMetodo: rep.porMetodo.map((s) => ({ metodo: s.label, monto: s.valor })),
      periodosConRentas: {
        anios: rep.aniosDisponibles,
        ...(periodo.anio != null ? { meses: rep.mesesDisponibles } : {}),
        ...(periodo.mes != null ? { semanas: rep.semanasDisponibles } : {}),
      },
    };
    if (args.incluirSerie) {
      resultado.serie = {
        titulo: rep.tituloSerie,
        puntos: rep.ingresosPorPeriodo
          .slice(-MAX_PUNTOS_SERIE)
          .map((s) => ({ etiqueta: s.label, monto: s.valor })),
      };
    }
    if (args.incluirTopClientes) {
      resultado.topClientes = rep.topClientes
        .slice(0, TOP_CLIENTES)
        .map((s) => ({ cliente: s.label, monto: s.valor }));
    }
    return resultado;
  },
});
