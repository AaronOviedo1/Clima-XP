import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopeNegocio, type ContextoCopiloto } from "../contexto";
import { ArgsInvalidos } from "../tool";
import type { LineaResumen } from "../accion";
import { pesos } from "@/lib/dinero";

// Lo que comparten las acciones sobre una unidad del inventario. Nunca se
// selecciona `Unidad.notas`: las notas no van al modelo.

export const unidadAccionSelect = {
  id: true,
  codigo: true,
  estado: true,
  modelo: { select: { nombre: true, tipo: true } },
  // Reportes de falla abiertos, el más reciente primero (misma noción de
  // "último abierto" que la pantalla de inventario).
  mantenimientos: {
    where: { resuelto: false },
    orderBy: { fecha: "desc" },
    select: { id: true, descripcion: true, costo: true, fecha: true },
  },
} satisfies Prisma.UnidadSelect;

export type UnidadAccion = Prisma.UnidadGetPayload<{ select: typeof unidadAccionSelect }>;

export const ETIQUETA_ESTADO_UNIDAD: Record<string, string> = {
  DISPONIBLE: "Disponible",
  RENTADA: "Rentada (en la calle)",
  MANTENIMIENTO: "En mantenimiento",
  BAJA: "De baja",
};

// Por código físico (EF-01, CAL-05…), sin distinguir mayúsculas.
export async function cargarUnidad(codigo: string, ctx: ContextoCopiloto): Promise<UnidadAccion> {
  const u = await prisma.unidad.findFirst({
    where: { codigo: { equals: codigo.trim(), mode: "insensitive" }, ...scopeNegocio(ctx) },
    select: unidadAccionSelect,
  });
  if (!u) {
    throw new ArgsInvalidos(
      `No encontré una unidad con el código "${codigo}". Búscala con buscar_unidades (los códigos son como EF-01, TF-02, CAL-05).`,
    );
  }
  return u;
}

// `fecha` del mantenimiento es un instante (no un día de calendario): se
// formatea en la zona del negocio.
const FECHA_HERMOSILLO = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "long",
  timeZone: "America/Hermosillo",
});
export function fechaInstante(d: Date): string {
  return FECHA_HERMOSILLO.format(d);
}

export function lineasUnidad(u: UnidadAccion): LineaResumen[] {
  const lineas: LineaResumen[] = [
    { etiqueta: "Unidad", valor: `${u.codigo} · ${u.modelo.nombre}` },
    { etiqueta: "Estado", valor: ETIQUETA_ESTADO_UNIDAD[u.estado] ?? u.estado },
  ];
  if (u.mantenimientos.length) {
    const m = u.mantenimientos[0];
    lineas.push({
      etiqueta: "Reportes abiertos",
      valor: `${u.mantenimientos.length} · último: ${m.descripcion}${m.costo != null ? ` (${pesos(m.costo)})` : ""}, ${fechaInstante(m.fecha)}`,
    });
  }
  return lineas;
}

// Cambia si la unidad cambia de estado o si se abre/cierra un reporte.
export function huellaUnidad(u: UnidadAccion): string {
  return `${u.estado}|${u.mantenimientos[0]?.id ?? "-"}|${u.mantenimientos.length}`;
}
