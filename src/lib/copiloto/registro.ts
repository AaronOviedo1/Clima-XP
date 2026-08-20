import "server-only";
import type { Rol } from "@prisma/client";
import type { Tool } from "./tool";
import { resumenOperativo } from "./tools/resumen-operativo";
import { disponibilidadEquipos } from "./tools/disponibilidad-equipos";
import { ingresosPeriodo } from "./tools/ingresos-periodo";
import { saldosPendientes } from "./tools/saldos-pendientes";
import { historialCliente } from "./tools/historial-cliente";

// Todas las tools del copiloto. El orden es el que verá el modelo.
export const TOOLS: readonly Tool[] = [
  resumenOperativo,
  disponibilidadEquipos,
  ingresosPeriodo,
  saldosPendientes,
  historialCliente,
];

// Las tools de un rol: las demás no existen para ese usuario (ni se le
// anuncian al modelo ni se pueden invocar en modo directo).
export function toolsParaRol(rol: Rol): Tool[] {
  return TOOLS.filter((t) => t.roles.includes(rol));
}

export function buscarTool(nombre: string, rol: Rol): Tool | null {
  return toolsParaRol(rol).find((t) => t.nombre === nombre) ?? null;
}
