import "server-only";
import { z } from "zod";
import { definirAccion } from "../accion";
import { ArgsInvalidos } from "../tool";
import { cargarRenta, etiquetaEstado, huellaRenta, lineasRenta } from "./renta-comun";
import { unidadesNoDisponibles } from "@/lib/disponibilidad";
import { cambiarEstadoRenta } from "@/lib/actions/rentas";

const argsConfirmar = z.strictObject({
  rentaId: z
    .string()
    .min(1)
    .max(40)
    .describe("Id de la cotización (renta en estado COTIZADA), tal cual lo devolvió una tool de lectura en este turno."),
});

/**
 * "El cliente aceptó la cotización": COTIZADA → CONFIRMADA. Es el momento en
 * que el equipo se aparta de verdad, así que aquí se pre-chequea la
 * disponibilidad (la action vuelve a revalidarla en transacción) y se exige
 * dirección; el copiloto no edita rentas, eso se captura en la app.
 */
export const proponerConfirmarCotizacion = definirAccion({
  nombre: "proponer_confirmar_cotizacion",
  descripcion:
    "PROPONE convertir una cotización (renta COTIZADA) en renta confirmada: aparta el equipo en esas fechas. No la ejecuta: la persona confirma en la tarjeta. Requiere que la cotización ya tenga dirección. Obtén el rentaId con una tool de lectura en este turno.",
  roles: ["ADMIN"],
  args: argsConfirmar,
  async preparar({ rentaId }, ctx) {
    const r = await cargarRenta(rentaId, ctx);
    if (r.estado !== "COTIZADA") {
      throw new ArgsInvalidos(
        `La renta de ${r.cliente.nombre} ya está ${etiquetaEstado(r.estado)}; solo una Cotizada se convierte en renta.`,
      );
    }
    if (!r.direccion.trim()) {
      throw new ArgsInvalidos(
        `La cotización de ${r.cliente.nombre} no tiene dirección; hay que capturarla en la app (Editar renta) antes de convertirla.`,
      );
    }
    const ocupadas = await unidadesNoDisponibles(
      r.unidades.map((u) => u.unidad.id),
      r.fechaInicio,
      r.fechaFin,
      r.id,
    );
    if (ocupadas.length) {
      throw new ArgsInvalidos(
        `No se puede confirmar: ${ocupadas.join(", ")} ya está(n) apartado(s) en esas fechas. Hay que cambiar el equipo de la cotización en la app.`,
      );
    }
    return {
      resumen: {
        titulo: `Convertir cotización en renta · ${r.cliente.nombre}`,
        lineas: [
          ...lineasRenta(r, ctx),
          { etiqueta: "Efecto", valor: "aparta el equipo en esas fechas y la renta pasa a Confirmada" },
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
    const res = await cambiarEstadoRenta(rentaId, "CONFIRMADA");
    return "error" in res
      ? { ok: false, error: res.error }
      : { ok: true, mensaje: "Cotización convertida en renta confirmada.", enlace: `/rentas/${rentaId}` };
  },
});
