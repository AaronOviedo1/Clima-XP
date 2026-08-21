import "server-only";
import { z } from "zod";
import { definirAccion } from "../accion";
import { ArgsInvalidos } from "../tool";
import {
  accesoriosEntregados,
  cargarRenta,
  etiquetaEstado,
  huellaRenta,
  lineasRenta,
} from "./renta-comun";
import { TRANSICIONES } from "@/lib/rentas";
import { marcarRecogida } from "@/lib/actions/rentas";

const argsRecoleccion = z.strictObject({
  rentaId: z
    .string()
    .min(1)
    .max(40)
    .describe("Id de la renta, tal cual lo devolvió una tool de lectura en este turno."),
});

// Lo que la persona desmarca en el diálogo: accesorios que NO regresaron.
const datosRecoleccion = z
  .strictObject({
    noRecogidos: z.array(z.string().min(1).max(40)).max(50),
  })
  .optional();

/**
 * "Ya recogí el equipo de Juan": ENTREGADA → RECOGIDA. Si en la entrega se
 * registraron accesorios, al confirmar se abre el mismo diálogo de la app para
 * revisar qué regresó; si no, es confirmación de un toque. Misma server action
 * (`marcarRecogida`): lo que falte no traba la renta, pero queda anotado.
 */
export const proponerRecoleccion = definirAccion({
  nombre: "proponer_recoleccion",
  descripcion:
    "PROPONE marcar una renta como RECOGIDA (el equipo ya regresó; la renta termina y el equipo queda libre). No la ejecuta: la persona confirma en la tarjeta y, si hubo accesorios, ahí mismo marca cuáles faltaron; tú no preguntes por accesorios. Solo aplica a rentas Entregadas. Obtén el rentaId con una tool de lectura en este turno.",
  roles: ["ADMIN", "REPARTIDOR"],
  args: argsRecoleccion,
  datosConfirmacion: datosRecoleccion,
  async preparar({ rentaId }, ctx) {
    const r = await cargarRenta(rentaId, ctx);
    if (!TRANSICIONES[r.estado].includes("RECOGIDA")) {
      throw new ArgsInvalidos(
        `La renta de ${r.cliente.nombre} está ${etiquetaEstado(r.estado)}; solo una renta Entregada se puede marcar como recogida.`,
      );
    }
    const n = accesoriosEntregados(r);
    return {
      resumen: {
        titulo: `Marcar Recogido · ${r.cliente.nombre}`,
        lineas: [
          ...lineasRenta(r, ctx),
          n > 0
            ? { etiqueta: "Accesorios", valor: `${n} registrados en la entrega; se revisan al confirmar` }
            : { etiqueta: "Accesorios", valor: "ninguno registrado en la entrega" },
        ],
        confirmacion: n > 0 ? { tipo: "recoleccion", rentaId: r.id } : { tipo: "simple" },
        enlace: `/rentas/${r.id}`,
      },
      entidadId: r.id,
    };
  },
  async huella({ rentaId }, ctx) {
    return huellaRenta(await cargarRenta(rentaId, ctx));
  },
  async ejecutar({ rentaId }, datos) {
    const res = await marcarRecogida(rentaId, datos?.noRecogidos ?? []);
    if ("error" in res) return { ok: false, error: res.error };
    return {
      ok: true,
      mensaje: `Renta marcada Recogida.${res.aviso ? ` ${res.aviso}.` : ""}`,
      enlace: `/rentas/${rentaId}`,
    };
  },
});
