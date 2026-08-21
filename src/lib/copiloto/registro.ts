import "server-only";
import type { Rol } from "@prisma/client";
import type { Tool } from "./tool";
import type { Accion } from "./accion";
import { accionesHabilitadas } from "./flag";
import { resumenOperativo } from "./tools/resumen-operativo";
import { buscarRentas } from "./tools/buscar-rentas";
import { disponibilidadEquipos } from "./tools/disponibilidad-equipos";
import { ingresosPeriodo } from "./tools/ingresos-periodo";
import { saldosPendientes } from "./tools/saldos-pendientes";
import { historialCliente } from "./tools/historial-cliente";
import { buscarUnidades } from "./tools/buscar-unidades";
import { proponerEnRuta } from "./acciones/en-ruta";
import { proponerEntrega } from "./acciones/entrega";
import { proponerRecoleccion } from "./acciones/recoleccion";
import { proponerPago } from "./acciones/pago";
import { proponerCancelarRenta } from "./acciones/cancelar-renta";
import { proponerConfirmarCotizacion } from "./acciones/confirmar-cotizacion";
import { proponerReporteFalla } from "./acciones/reportar-falla";
import { proponerResolverMantenimiento } from "./acciones/resolver-mantenimiento";
import { proponerRenta } from "./acciones/crear-renta";
import { proponerEditarRenta } from "./acciones/editar-renta";

// Todas las tools de lectura del copiloto. El orden es el que verá el modelo.
export const TOOLS: readonly Tool[] = [
  resumenOperativo,
  buscarRentas,
  disponibilidadEquipos,
  ingresosPeriodo,
  saldosPendientes,
  historialCliente,
  buscarUnidades,
];

// Las acciones (escritura con confirmación). Solo existen con el flag
// COPILOTO_ACCIONES_HABILITADAS prendido.
export const ACCIONES: readonly Accion[] = [
  proponerEnRuta,
  proponerEntrega,
  proponerRecoleccion,
  proponerPago,
  proponerCancelarRenta,
  proponerConfirmarCotizacion,
  proponerReporteFalla,
  proponerResolverMantenimiento,
  proponerRenta,
  proponerEditarRenta,
];

// Las tools de un rol: las demás no existen para ese usuario (ni se le
// anuncian al modelo ni se pueden invocar en modo directo).
export function toolsParaRol(rol: Rol): Tool[] {
  return TOOLS.filter((t) => t.roles.includes(rol));
}

export function buscarTool(nombre: string, rol: Rol): Tool | null {
  return toolsParaRol(rol).find((t) => t.nombre === nombre) ?? null;
}

export function accionesParaRol(rol: Rol): Accion[] {
  if (!accionesHabilitadas()) return [];
  return ACCIONES.filter((a) => a.roles.includes(rol));
}

export function buscarAccion(nombre: string, rol: Rol): Accion | null {
  return accionesParaRol(rol).find((a) => a.nombre === nombre) ?? null;
}
