import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ArgsInvalidos, definirTool } from "@/lib/copiloto/tool";
import { scopeNegocio } from "@/lib/copiloto/contexto";
import { fechaArg } from "@/lib/copiloto/comunes";
import { ESTADOS_ACTIVOS, condicionTraslape } from "@/lib/disponibilidad";
import { diasDeRenta, fechaDesdeInput, sumarDiasInput } from "@/lib/fechas";

const MAX_DIAS = 60;

export const argsDisponibilidad = z.strictObject({
  inicio: fechaArg
    .optional()
    .describe("Día de entrega (yyyy-mm-dd). Si se omite, hoy."),
  fin: fechaArg
    .optional()
    .describe(
      "Día de recolección (yyyy-mm-dd). Si se omite, el día siguiente a inicio. Puede ser igual a inicio (renta de un solo día).",
    ),
});

export type DisponibilidadModelo = {
  modelo: string;
  tipo: "AEROCOOLER" | "CALENTON";
  precioDia: number;
  precioDia3Mas: number | null;
  totalUnidades: number;
  totalActivas: number; // sin MANTENIMIENTO ni BAJA: las que se pueden rentar
  libresEnRango: number; // activas sin renta que traslape el rango
  enMantenimiento: number;
  deBaja: number;
};

export type DisponibilidadEquipos = {
  rango: { inicio: string; fin: string; dias: number };
  modelos: DisponibilidadModelo[]; // solo modelos con unidades en inventario
  // Modelos del catálogo que todavía no tienen ninguna unidad (p. ej. uno que
  // se va a ofrecer más adelante): se nombran para poder decir "aún no hay",
  // pero no se listan con precio como si fueran rentables.
  modelosSinUnidades: string[];
  totales: { libres: number; activas: number; enMantenimiento: number };
};

export const disponibilidadEquipos = definirTool({
  nombre: "disponibilidad_equipos",
  descripcion:
    "Cuántas unidades libres hay de cada modelo (aerocoolers y calentones) para un rango de fechas, con el precio por día, y cuántas hay en total, en mantenimiento o de baja. La ocupación es [inicio, fin): el día de recolección la unidad ya cuenta como libre. Los modelos del catálogo que todavía no tienen unidades vienen aparte en modelosSinUnidades (no se pueden rentar aún). Úsala para '¿tengo N equipos para tal fecha?', '¿qué hay disponible este fin de semana?', '¿cuántos calentones están en taller?'.",
  roles: ["ADMIN", "REPARTIDOR"],
  args: argsDisponibilidad,
  async ejecutar(args, ctx) {
    const inicio = args.inicio ?? ctx.hoy;
    const fin = args.fin ?? sumarDiasInput(inicio, 1);
    // Comparación de cadenas: "yyyy-mm-dd" ordena igual que la fecha.
    if (fin < inicio)
      throw new ArgsInvalidos(
        "La fecha de fin no puede ser anterior a la de inicio.",
      );
    const dInicio = fechaDesdeInput(inicio);
    const dFin = fechaDesdeInput(fin);
    const dias = diasDeRenta(dInicio, dFin);
    if (dias > MAX_DIAS)
      throw new ArgsInvalidos(`El rango no puede pasar de ${MAX_DIAS} días.`);

    const scope = scopeNegocio(ctx);
    // Tres queries fijas; los conteos los hace Postgres (groupBy), aquí solo se
    // cruzan por modelo. La regla de ocupación es la misma del alta de renta
    // (condicionTraslape + ESTADOS_ACTIVOS): lo que esta tool dice "libre" es
    // lo que el formulario dejaría elegir.
    const [modelos, porEstado, libres] = await Promise.all([
      prisma.modeloEquipo.findMany({
        where: { ...scope },
        select: {
          id: true,
          nombre: true,
          tipo: true,
          precioDia: true,
          precioDia3Mas: true,
        },
        orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
      }),
      prisma.unidad.groupBy({
        by: ["modeloId", "estado"],
        where: { ...scope },
        _count: { _all: true },
      }),
      prisma.unidad.groupBy({
        by: ["modeloId"],
        where: {
          ...scope,
          estado: { notIn: ["MANTENIMIENTO", "BAJA"] },
          rentaItems: {
            none: {
              renta: {
                estado: { in: [...ESTADOS_ACTIVOS] },
                ...condicionTraslape(dInicio, dFin),
              },
            },
          },
        },
        _count: { _all: true },
      }),
    ]);

    const conteo = new Map<string, Record<string, number>>();
    for (const f of porEstado) {
      const c = conteo.get(f.modeloId) ?? {};
      c[f.estado] = f._count._all;
      conteo.set(f.modeloId, c);
    }
    const libresPorModelo = new Map(
      libres.map((f) => [f.modeloId, f._count._all]),
    );

    const sinUnidades = modelos
      .filter((m) => !conteo.has(m.id))
      .map((m) => m.nombre);
    const filas: DisponibilidadModelo[] = modelos
      .filter((m) => conteo.has(m.id))
      .map((m) => {
        const c = conteo.get(m.id) ?? {};
        const enMantenimiento = c.MANTENIMIENTO ?? 0;
        const deBaja = c.BAJA ?? 0;
        const totalUnidades = Object.values(c).reduce((a, n) => a + n, 0);
        return {
          modelo: m.nombre,
          tipo: m.tipo,
          precioDia: m.precioDia,
          precioDia3Mas: m.precioDia3Mas,
          totalUnidades,
          totalActivas: totalUnidades - enMantenimiento - deBaja,
          libresEnRango: libresPorModelo.get(m.id) ?? 0,
          enMantenimiento,
          deBaja,
        };
      });

    const resultado: DisponibilidadEquipos = {
      rango: { inicio, fin, dias },
      modelos: filas,
      modelosSinUnidades: sinUnidades,
      totales: {
        libres: filas.reduce((a, f) => a + f.libresEnRango, 0),
        activas: filas.reduce((a, f) => a + f.totalActivas, 0),
        enMantenimiento: filas.reduce((a, f) => a + f.enMantenimiento, 0),
      },
    };
    return resultado;
  },
});
