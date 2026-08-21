import "server-only";
import { z } from "zod";
import { definirAccion } from "../accion";
import { ArgsInvalidos } from "../tool";
import { cargarRenta, etiquetaEstado, huellaRenta, lineasRenta } from "./renta-comun";
import { TRANSICIONES } from "@/lib/rentas";
import { cambiarEstadoRenta } from "@/lib/actions/rentas";

export const argsEnRuta = z.strictObject({
  rentaId: z
    .string()
    .min(1)
    .max(40)
    .describe("Id de la renta, tal cual lo devolvió una tool de lectura en este turno."),
});

/**
 * "Ya salí con el equipo de Juan": CONFIRMADA → EN_RUTA. Misma transición que
 * el botón "En ruta" del dashboard, así que la puede proponer cualquiera de
 * los dos roles. La propuesta se ejecuta con `cambiarEstadoRenta`, que vuelve
 * a validar la transición por su cuenta.
 */
export const proponerEnRuta = definirAccion({
  nombre: "proponer_en_ruta",
  descripcion:
    "PROPONE marcar una renta como EN RUTA (el repartidor salió a entregarla). No la ejecuta: crea una propuesta que la persona confirma con el botón de la tarjeta. Solo aplica a rentas CONFIRMADAS. Obtén el rentaId con una tool de lectura en este mismo turno.",
  roles: ["ADMIN", "REPARTIDOR"],
  args: argsEnRuta,
  async preparar({ rentaId }, ctx) {
    const r = await cargarRenta(rentaId, ctx);
    if (!TRANSICIONES[r.estado].includes("EN_RUTA")) {
      throw new ArgsInvalidos(
        `La renta de ${r.cliente.nombre} está ${etiquetaEstado(r.estado)}; solo una renta Confirmada se puede poner en ruta.`,
      );
    }
    return {
      resumen: {
        titulo: `Marcar En ruta · ${r.cliente.nombre}`,
        lineas: lineasRenta(r, ctx),
        confirmacion: { tipo: "simple" },
        enlace: `/rentas/${r.id}`,
      },
      entidadId: r.id,
    };
  },
  async huella({ rentaId }, ctx) {
    return huellaRenta(await cargarRenta(rentaId, ctx));
  },
  async ejecutar({ rentaId }) {
    const res = await cambiarEstadoRenta(rentaId, "EN_RUTA");
    return "error" in res
      ? { ok: false, error: res.error }
      : { ok: true, mensaje: "Renta marcada En ruta.", enlace: `/rentas/${rentaId}` };
  },
});
