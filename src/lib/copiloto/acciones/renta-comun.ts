import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopeNegocio, type ContextoCopiloto } from "../contexto";
import { ArgsInvalidos } from "../tool";
import { recortar, textoEquipos } from "../comunes";
import type { LineaResumen } from "../accion";
import { equiposPorModelo, ESTADO_RENTA_META, rentaListSelect, totalesDeRenta } from "@/lib/rentas";
import { fechaLarga } from "@/lib/fechas";
import { pesos } from "@/lib/dinero";

// Lo que comparten las acciones sobre una renta: cómo se carga (con el scope),
// cómo se resume en la tarjeta y cómo se toma su huella.

export const rentaAccionSelect = {
  ...rentaListSelect,
  updatedAt: true,
  ventanaEntrega: true,
  unidades: {
    select: {
      precioDia: true,
      unidad: { select: { id: true, codigo: true, modelo: { select: { nombre: true, tipo: true } } } },
    },
  },
} satisfies Prisma.RentaSelect;

export type RentaAccion = Prisma.RentaGetPayload<{ select: typeof rentaAccionSelect }>;

export async function cargarRenta(rentaId: string, ctx: ContextoCopiloto): Promise<RentaAccion> {
  const r = await prisma.renta.findFirst({
    where: { id: rentaId, ...scopeNegocio(ctx) },
    select: rentaAccionSelect,
  });
  if (!r) {
    throw new ArgsInvalidos(
      "No encontré esa renta. Búscala primero con buscar_rentas, resumen_operativo, saldos_pendientes o historial_cliente y usa el rentaId que devuelvan.",
    );
  }
  return r;
}

export function etiquetaEstado(estado: string): string {
  return ESTADO_RENTA_META[estado]?.label ?? estado;
}

// Líneas de la tarjeta. El dinero solo para ADMIN: el repartidor no lo ve en
// la app y tampoco lo ve aquí (las claves no se agregan, no van en 0).
export function lineasRenta(r: RentaAccion, ctx: ContextoCopiloto): LineaResumen[] {
  const lineas: LineaResumen[] = [
    { etiqueta: "Cliente", valor: r.cliente.nombre },
    { etiqueta: "Estado", valor: etiquetaEstado(r.estado) },
    { etiqueta: "Entrega", valor: fechaLarga(r.fechaInicio) },
    { etiqueta: "Recolección", valor: fechaLarga(r.fechaFin) },
    { etiqueta: "Equipo", valor: textoEquipos(equiposPorModelo(r.unidades)) || "—" },
    { etiqueta: "Códigos", valor: r.unidades.map((u) => u.unidad.codigo).join(", ") || "—" },
  ];
  if (r.direccion.trim()) lineas.push({ etiqueta: "Dirección", valor: recortar(r.direccion, 80) });
  if (r.ventanaEntrega) lineas.push({ etiqueta: "Ventana", valor: r.ventanaEntrega });
  if (ctx.rol === "ADMIN") {
    const t = totalesDeRenta(r);
    lineas.push(
      { etiqueta: "Total", valor: pesos(t.total) },
      { etiqueta: "Pagado", valor: pesos(t.pagadoConfirmado) },
      { etiqueta: "Saldo", valor: pesos(t.saldo) },
    );
  }
  return lineas;
}

// Cambia con cualquier update de la renta (estado, entrega, recolección…).
// No sirve para pagos: crear un Pago no toca Renta.updatedAt.
export function huellaRenta(r: RentaAccion): string {
  return `${r.estado}|${r.updatedAt.toISOString()}`;
}

export function tiposEquipo(r: RentaAccion): string[] {
  return [...new Set(r.unidades.map((u) => u.unidad.modelo.tipo as string))];
}

export function accesoriosEntregados(r: RentaAccion): number {
  return r.accesorios.length;
}
