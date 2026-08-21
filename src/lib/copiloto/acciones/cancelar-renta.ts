import "server-only";
import { z } from "zod";
import { definirAccion } from "../accion";
import { ArgsInvalidos } from "../tool";
import { cargarRenta, etiquetaEstado, huellaRenta, lineasRenta } from "./renta-comun";
import { TRANSICIONES, totalesDeRenta } from "@/lib/rentas";
import { cambiarEstadoRenta } from "@/lib/actions/rentas";
import { pesos } from "@/lib/dinero";

const argsCancelar = z.strictObject({
  rentaId: z
    .string()
    .min(1)
    .max(40)
    .describe("Id de la renta, tal cual lo devolvió una tool de lectura en este turno."),
});

/**
 * "Cancela la renta de Juan": → CANCELADA. Libera el equipo y deja la renta
 * sin saldo; el retroceso solo lo puede hacer el admin desde la app, por eso
 * es solo-admin aquí aunque el botón de la UI lo vea cualquiera.
 */
export const proponerCancelarRenta = definirAccion({
  nombre: "proponer_cancelar_renta",
  descripcion:
    "PROPONE cancelar una renta (Cotizada, Confirmada o En ruta): libera el equipo y la renta deja de cobrarse. No la ejecuta: la persona confirma en la tarjeta. Si el equipo ya se entregó no se cancela, se recoge (proponer_recoleccion). Obtén el rentaId con una tool de lectura en este turno.",
  roles: ["ADMIN"],
  args: argsCancelar,
  async preparar({ rentaId }, ctx) {
    const r = await cargarRenta(rentaId, ctx);
    if (!TRANSICIONES[r.estado].includes("CANCELADA")) {
      throw new ArgsInvalidos(
        `La renta de ${r.cliente.nombre} está ${etiquetaEstado(r.estado)}; solo se cancela una Cotizada, Confirmada o En ruta. Con el equipo ya entregado lo que procede es recogerlo.`,
      );
    }
    const t = totalesDeRenta(r);
    return {
      resumen: {
        titulo: `Cancelar renta · ${r.cliente.nombre}`,
        lineas: [
          ...lineasRenta(r, ctx),
          ...(t.pagadoConfirmado > 0
            ? [{ etiqueta: "Ojo", valor: `Ya pagó ${pesos(t.pagadoConfirmado)}; si procede devolverlo, se registra aparte como reembolso.` }]
            : []),
          { etiqueta: "Efecto", valor: "libera el equipo en esas fechas y la renta queda sin saldo" },
        ],
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
    const res = await cambiarEstadoRenta(rentaId, "CANCELADA");
    return "error" in res
      ? { ok: false, error: res.error }
      : { ok: true, mensaje: "Renta cancelada.", enlace: `/rentas/${rentaId}` };
  },
});
