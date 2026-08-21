import "server-only";
import { z } from "zod";
import { definirAccion } from "../accion";
import { ArgsInvalidos } from "../tool";
import { cargarRenta, etiquetaEstado, huellaRenta, lineasRenta, tiposEquipo } from "./renta-comun";
import { TRANSICIONES } from "@/lib/rentas";
import { marcarEntregada } from "@/lib/actions/rentas";

const argsEntrega = z.strictObject({
  rentaId: z
    .string()
    .min(1)
    .max(40)
    .describe("Id de la renta, tal cual lo devolvió una tool de lectura en este turno."),
});

// Lo que la persona elige en el diálogo al confirmar: qué accesorios se
// dejaron. Lo decide ella, no el modelo (por eso no va en los args).
const datosEntrega = z
  .strictObject({
    accesorioIds: z.array(z.string().min(1).max(40)).max(50),
  })
  .optional();

/**
 * "Ya le dejé el equipo a Juan": CONFIRMADA/EN_RUTA → ENTREGADA, con los
 * accesorios capturados en el mismo diálogo que usa la app. Misma server
 * action del dashboard (`marcarEntregada`), que revalida la transición.
 */
export const proponerEntrega = definirAccion({
  nombre: "proponer_entrega",
  descripcion:
    "PROPONE marcar una renta como ENTREGADA (el equipo ya quedó con el cliente). No la ejecuta: la persona confirma en la tarjeta y ahí mismo marca qué accesorios se dejaron (mangueras, extensiones, tambos); tú no preguntes por accesorios. Aplica a rentas Confirmadas o En ruta. Obtén el rentaId con una tool de lectura en este turno.",
  roles: ["ADMIN", "REPARTIDOR"],
  args: argsEntrega,
  datosConfirmacion: datosEntrega,
  async preparar({ rentaId }, ctx) {
    const r = await cargarRenta(rentaId, ctx);
    if (!TRANSICIONES[r.estado].includes("ENTREGADA")) {
      throw new ArgsInvalidos(
        `La renta de ${r.cliente.nombre} está ${etiquetaEstado(r.estado)}; solo una renta Confirmada o En ruta se puede marcar como entregada.`,
      );
    }
    return {
      resumen: {
        titulo: `Marcar Entregado · ${r.cliente.nombre}`,
        lineas: [
          ...lineasRenta(r, ctx),
          { etiqueta: "Al confirmar", valor: "se marcan los accesorios que se dejan con el equipo" },
        ],
        confirmacion: { tipo: "entrega", tiposEquipo: tiposEquipo(r) },
        enlace: `/rentas/${r.id}`,
      },
      entidadId: r.id,
    };
  },
  async huella({ rentaId }, ctx) {
    return huellaRenta(await cargarRenta(rentaId, ctx));
  },
  async ejecutar({ rentaId }, datos) {
    const accesorioIds = datos?.accesorioIds ?? [];
    const res = await marcarEntregada(rentaId, accesorioIds);
    if ("error" in res) return { ok: false, error: res.error };
    const extra = accesorioIds.length
      ? ` Accesorios registrados: ${accesorioIds.length}.`
      : " Sin accesorios registrados.";
    return { ok: true, mensaje: `Renta marcada Entregada.${extra}`, enlace: `/rentas/${rentaId}` };
  },
});
