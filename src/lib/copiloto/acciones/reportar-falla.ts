import "server-only";
import { z } from "zod";
import { definirAccion } from "../accion";
import { ArgsInvalidos } from "../tool";
import { cargarUnidad, huellaUnidad, lineasUnidad } from "./unidad-comun";
import { reportarMantenimiento } from "@/lib/actions/inventario";
import { pesos } from "@/lib/dinero";

const argsReporte = z.strictObject({
  codigo: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .describe("Código físico de la unidad (EF-01, TF-02, CAL-05…), tal cual lo dijo la persona o lo devolvió buscar_unidades."),
  descripcion: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .describe("Qué falla tiene, con las palabras de la persona ('no prende', 'la bomba falla')."),
  costo: z
    .number()
    .int()
    .nonnegative()
    .max(100_000)
    .optional()
    .describe("Costo de la reparación en pesos enteros, SOLO si la persona lo dijo. Nunca lo supongas."),
});

/**
 * "El CAL-05 no prende": abre un reporte de falla y manda la unidad a
 * mantenimiento (deja de ofrecerse). Misma server action que /inventario.
 */
export const proponerReporteFalla = definirAccion({
  nombre: "proponer_reporte_falla",
  descripcion:
    "PROPONE reportar una falla en una unidad del inventario: abre el reporte y la unidad pasa a MANTENIMIENTO (deja de ofrecerse para rentar). No lo ejecuta: la persona confirma en la tarjeta. Si dudas del código, búscalo con buscar_unidades.",
  roles: ["ADMIN"],
  args: argsReporte,
  procedencia: (a) => (a.costo != null ? [a.costo] : []),
  async preparar({ codigo, descripcion, costo }, ctx) {
    const u = await cargarUnidad(codigo, ctx);
    if (u.estado === "BAJA") {
      throw new ArgsInvalidos(`La unidad ${u.codigo} está de baja; no se le reportan fallas.`);
    }
    return {
      resumen: {
        titulo: `Reportar falla · ${u.codigo}`,
        lineas: [
          ...lineasUnidad(u),
          { etiqueta: "Falla", valor: descripcion },
          { etiqueta: "Costo", valor: costo != null ? pesos(costo) : "sin costo capturado" },
          ...(u.estado === "RENTADA"
            ? [{ etiqueta: "Ojo", valor: "está en la calle con un cliente; queda En mantenimiento desde ahora" }]
            : []),
          ...(u.mantenimientos.length
            ? [{ etiqueta: "Ojo", valor: `ya tiene ${u.mantenimientos.length} reporte(s) abierto(s); este se suma` }]
            : []),
          { etiqueta: "Efecto", valor: "se abre el reporte y la unidad pasa a En mantenimiento" },
        ],
        confirmacion: { tipo: "simple" },
        enlace: "/inventario",
      },
      entidadId: u.id,
    };
  },
  async huella({ codigo }, ctx) {
    return huellaUnidad(await cargarUnidad(codigo, ctx));
  },
  async ejecutar({ codigo, descripcion, costo }, _datos, ctx) {
    const u = await cargarUnidad(codigo, ctx);
    const res = await reportarMantenimiento(u.id, { descripcion, costo: costo ?? null });
    return "error" in res
      ? { ok: false, error: res.error }
      : { ok: true, mensaje: `Falla reportada; ${u.codigo} quedó En mantenimiento.`, enlace: "/inventario" };
  },
});
