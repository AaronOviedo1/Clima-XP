import "server-only";
import { z } from "zod";
import { definirAccion } from "../accion";
import { ArgsInvalidos } from "../tool";
import { cargarUnidad, fechaInstante, huellaUnidad, lineasUnidad } from "./unidad-comun";
import { resolverMantenimiento } from "@/lib/actions/inventario";
import { pesos } from "@/lib/dinero";

const argsResolver = z.strictObject({
  codigo: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .describe("Código físico de la unidad (EF-01, TF-02, CAL-05…) cuyo reporte de falla ya se atendió."),
});

/**
 * "Ya arreglaron el CAL-05": cierra el último reporte abierto de la unidad y,
 * si no queda otro, la regresa a DISPONIBLE. Misma server action que el botón
 * "Resolver" de /inventario.
 */
export const proponerResolverMantenimiento = definirAccion({
  nombre: "proponer_resolver_mantenimiento",
  descripcion:
    "PROPONE dar por resuelto el último reporte de falla abierto de una unidad; si no le quedan reportes abiertos, la unidad vuelve a DISPONIBLE. No lo ejecuta: la persona confirma en la tarjeta. Si dudas del código, búscalo con buscar_unidades (trae el reporte abierto).",
  roles: ["ADMIN"],
  args: argsResolver,
  async preparar({ codigo }, ctx) {
    const u = await cargarUnidad(codigo, ctx);
    const abierto = u.mantenimientos[0];
    if (!abierto) {
      throw new ArgsInvalidos(`La unidad ${u.codigo} no tiene reportes de falla abiertos.`);
    }
    const quedanOtros = u.mantenimientos.length > 1;
    const efecto = quedanOtros
      ? `se cierra este reporte; quedan ${u.mantenimientos.length - 1} abierto(s) y la unidad sigue En mantenimiento`
      : u.estado === "MANTENIMIENTO"
        ? "se cierra el reporte y la unidad vuelve a Disponible"
        : `se cierra el reporte; la unidad sigue ${u.estado === "RENTADA" ? "rentada" : u.estado.toLowerCase()}`;
    return {
      resumen: {
        titulo: `Resolver mantenimiento · ${u.codigo}`,
        lineas: [
          ...lineasUnidad(u).filter((l) => l.etiqueta !== "Reportes abiertos"),
          { etiqueta: "Reporte", valor: abierto.descripcion },
          { etiqueta: "Costo", valor: abierto.costo != null ? pesos(abierto.costo) : "sin costo capturado" },
          { etiqueta: "Reportado", valor: fechaInstante(abierto.fecha) },
          { etiqueta: "Efecto", valor: efecto },
        ],
        confirmacion: { tipo: "simple" },
        enlace: "/inventario",
      },
      entidadId: abierto.id,
    };
  },
  async huella({ codigo }, ctx) {
    return huellaUnidad(await cargarUnidad(codigo, ctx));
  },
  async ejecutar({ codigo }, _datos, ctx) {
    // La huella garantiza que el "último abierto" es el mismo que se propuso.
    const u = await cargarUnidad(codigo, ctx);
    const abierto = u.mantenimientos[0];
    if (!abierto) return { ok: false, error: `La unidad ${u.codigo} ya no tiene reportes abiertos.` };
    const res = await resolverMantenimiento(abierto.id);
    if ("error" in res) return { ok: false, error: res.error };
    const quedan = u.mantenimientos.length - 1;
    return {
      ok: true,
      mensaje:
        quedan > 0
          ? `Reporte resuelto; ${u.codigo} sigue con ${quedan} abierto(s).`
          : u.estado === "MANTENIMIENTO"
            ? `Reporte resuelto; ${u.codigo} vuelve a estar Disponible.`
            : `Reporte resuelto en ${u.codigo}.`,
      enlace: "/inventario",
    };
  },
});
