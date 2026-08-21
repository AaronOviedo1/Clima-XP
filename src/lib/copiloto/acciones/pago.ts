import "server-only";
import { z } from "zod";
import { definirAccion } from "../accion";
import { ArgsInvalidos } from "../tool";
import { cargarRenta, etiquetaEstado, lineasRenta } from "./renta-comun";
import { ESTADOS_SIN_COBRO, totalesDeRenta } from "@/lib/rentas";
import { registrarPago } from "@/lib/actions/rentas";
import { pesos } from "@/lib/dinero";
import { fechaLarga } from "@/lib/fechas";

const METODO = ["EFECTIVO", "TRANSFERENCIA", "LINK_MERCADO_PAGO", "OTRO"] as const;
const TIPO = ["ANTICIPO", "LIQUIDACION", "REEMBOLSO"] as const;

const ETIQUETA_METODO: Record<(typeof METODO)[number], string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  LINK_MERCADO_PAGO: "Link de Mercado Pago",
  OTRO: "Otro",
};
const ETIQUETA_TIPO: Record<(typeof TIPO)[number], string> = {
  ANTICIPO: "Anticipo",
  LIQUIDACION: "Liquidación",
  REEMBOLSO: "Reembolso",
};

const argsPago = z.strictObject({
  rentaId: z
    .string()
    .min(1)
    .max(40)
    .describe("Id de la renta, tal cual lo devolvió una tool de lectura en este turno."),
  monto: z
    .number()
    .int()
    .positive()
    .max(1_000_000)
    .describe("Pesos enteros, EXACTAMENTE como lo dijo la persona. Nunca lo supongas ni lo completes con el saldo."),
  metodo: z
    .enum(METODO)
    .describe("Cómo pagó. Si la persona no lo dijo, pregúntaselo; no lo supongas."),
  tipo: z
    .enum(TIPO)
    .optional()
    .describe("Default LIQUIDACION (pago normal). ANTICIPO: adelanto antes de la entrega. REEMBOLSO: dinero que se le devuelve al cliente."),
});

/**
 * "Regístrale $500 en efectivo a Juan". Misma server action que la pantalla
 * de la renta (`registrarPago`), pero con precondiciones que la UI no tiene
 * —la action no topa nada—: la renta debe generar cobro, un pago no puede
 * superar el saldo y un reembolso no puede superar lo pagado. El saldo
 * resultante lo calcula el servidor y va en la tarjeta.
 */
export const proponerPago = definirAccion({
  nombre: "proponer_pago",
  descripcion:
    "PROPONE registrar un pago (o anticipo, o reembolso) en una renta. No lo ejecuta: la persona confirma en la tarjeta, donde ve total, pagado, saldo actual y saldo después. El monto y el método tienen que venir de la persona. Obtén el rentaId con una tool de lectura en este turno (saldos_pendientes, buscar_rentas, historial_cliente).",
  roles: ["ADMIN"],
  args: argsPago,
  procedencia: (a) => [a.monto],
  async preparar({ rentaId, monto, metodo, tipo: tipoArg }, ctx) {
    const tipo = tipoArg ?? "LIQUIDACION";
    const r = await cargarRenta(rentaId, ctx);
    if (ESTADOS_SIN_COBRO.includes(r.estado)) {
      throw new ArgsInvalidos(
        `La renta de ${r.cliente.nombre} está ${etiquetaEstado(r.estado)} y no genera cobro; no se le registran pagos.`,
      );
    }
    const t = totalesDeRenta(r);
    if (tipo === "REEMBOLSO") {
      if (monto > t.pagadoConfirmado) {
        throw new ArgsInvalidos(
          `No se puede reembolsar ${pesos(monto)}: la renta de ${r.cliente.nombre} solo tiene pagados ${pesos(t.pagadoConfirmado)}.`,
        );
      }
    } else {
      if (t.saldo <= 0) {
        throw new ArgsInvalidos(
          `La renta de ${r.cliente.nombre} no debe nada (total ${pesos(t.total)}, pagado ${pesos(t.pagadoConfirmado)}). Si hay que devolverle dinero, es un REEMBOLSO.`,
        );
      }
      if (monto > t.saldo) {
        throw new ArgsInvalidos(
          `El monto ${pesos(monto)} supera el saldo ${pesos(t.saldo)} de la renta de ${r.cliente.nombre} (total ${pesos(t.total)}, pagado ${pesos(t.pagadoConfirmado)}). Confirma con la persona el monto correcto.`,
        );
      }
    }
    const saldoDespues = tipo === "REEMBOLSO" ? t.saldo + monto : t.saldo - monto;
    const detalle = `${pesos(monto)} · ${ETIQUETA_METODO[metodo]} · ${ETIQUETA_TIPO[tipo]}`;
    return {
      resumen: {
        titulo: `${tipo === "REEMBOLSO" ? "Registrar reembolso" : "Registrar pago"} ${pesos(monto)} · ${r.cliente.nombre}`,
        lineas: [
          { etiqueta: "Cliente", valor: r.cliente.nombre },
          { etiqueta: "Renta", valor: `${etiquetaEstado(r.estado)} · entrega ${fechaLarga(r.fechaInicio)}` },
          ...lineasRenta(r, ctx).filter((l) => l.etiqueta === "Equipo"),
          { etiqueta: "Total", valor: pesos(t.total) },
          { etiqueta: "Pagado", valor: pesos(t.pagadoConfirmado) },
          { etiqueta: "Saldo actual", valor: pesos(t.saldo) },
          { etiqueta: tipo === "REEMBOLSO" ? "Reembolso" : "Pago", valor: detalle },
          { etiqueta: "Saldo después", valor: pesos(saldoDespues) },
        ],
        confirmacion: { tipo: "simple" },
        enlace: `/rentas/${r.id}`,
      },
      entidadId: r.id,
    };
  },
  // Crear un Pago no toca Renta.updatedAt: la huella es el dinero.
  async huella({ rentaId }, ctx) {
    const r = await cargarRenta(rentaId, ctx);
    const t = totalesDeRenta(r);
    return `${r.estado}|saldo:${t.saldo}|pagado:${t.pagadoConfirmado}`;
  },
  async ejecutar({ rentaId, monto, metodo, tipo }) {
    const res = await registrarPago(rentaId, { monto, metodo, tipo: tipo ?? "LIQUIDACION" });
    if ("error" in res) return { ok: false, error: res.error };
    const que = tipo === "REEMBOLSO" ? "Reembolso" : tipo === "ANTICIPO" ? "Anticipo" : "Pago";
    return { ok: true, mensaje: `${que} de ${pesos(monto)} registrado.`, enlace: `/rentas/${rentaId}` };
  },
});
