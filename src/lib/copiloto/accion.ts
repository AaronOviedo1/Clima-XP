import type { Rol } from "@prisma/client";
import { z } from "zod";
import type { ContextoCopiloto } from "./contexto";

/**
 * Contrato de una ACCIÓN del copiloto (escritura). A diferencia de una tool de
 * lectura, una acción nunca se ejecuta cuando el modelo la llama: la llamada
 * solo PREPARA una propuesta (precondiciones + resumen legible, con los
 * números calculados en el servidor) que se persiste en `AccionCopiloto`; la
 * persona la confirma desde la tarjeta del chat y solo entonces `ejecutar`
 * llama a la server action EXISTENTE (la misma de la UI, con sus mismas
 * validaciones). El modelo controla únicamente `args` (z.strictObject); el
 * contexto llega de la sesión y los args que se ejecutan son los persistidos.
 *
 * Este módulo no lleva "server-only" a propósito: el widget importa los TIPOS
 * (PropuestaCliente) de aquí; las queries viven en propuestas.ts.
 */

// Qué le pide el widget a la persona al tocar Confirmar: nada, o los mismos
// diálogos de accesorios que usa la app al marcar Entregado / Recogido.
export type ConfirmacionUI =
  | { tipo: "simple" }
  | { tipo: "entrega"; tiposEquipo: string[] }
  | { tipo: "recoleccion"; rentaId: string };

export type LineaResumen = { etiqueta: string; valor: string };

// Lo que ve la persona antes de confirmar. Para REPARTIDOR no lleva dinero.
export type ResumenAccion = {
  titulo: string; // "Marcar En ruta · Juan Pérez"
  lineas: LineaResumen[];
  confirmacion: ConfirmacionUI;
  enlace?: string; // "/rentas/<id>" para "Ver renta"
};

// CONFIRMADA es transitorio: reclamada por la confirmación y ejecutándose.
export type EstadoPropuesta =
  | "PROPUESTA"
  | "CONFIRMADA"
  | "EJECUTADA"
  | "FALLIDA"
  | "CANCELADA"
  | "EXPIRADA";

// DTO que viaja al widget (y se guarda en su sessionStorage).
export type PropuestaCliente = {
  id: string;
  tipo: string; // nombre de la acción
  titulo: string;
  lineas: LineaResumen[];
  confirmacion: ConfirmacionUI;
  enlace?: string;
  expiraEn: string; // ISO
  estado: EstadoPropuesta;
  resultado?: string; // mensaje final ("Renta marcada En ruta", "Ya no están disponibles: EF-01")
};

// `ejecucion`: lo que la acción resolvió al proponer y que ejecutar() debe usar tal
// cual (unidades concretas, km, desglose): se persiste con la propuesta.
export type Preparacion = { resumen: ResumenAccion; entidadId: string | null; ejecucion?: unknown };

export type ResultadoEjecucion =
  | { ok: true; mensaje: string; enlace?: string }
  | { ok: false; error: string };

export type DefinicionAccion<S extends z.ZodType, D extends z.ZodType = z.ZodUndefined> = {
  nombre: string; // "proponer_en_ruta": es el nombre que ve el modelo
  descripcion: string; // para el modelo: debe dejar claro que SOLO propone
  roles: readonly Rol[];
  args: S; // z.strictObject: una clave inventada se rechaza
  // Lo que elige la persona en el diálogo al confirmar (accesorios); default: nada.
  datosConfirmacion?: D;
  // Números de los args que tienen que venir textuales de la persona o de una
  // tool de este turno (montos, costos, cantidades): el runner los exige.
  procedencia?(args: z.infer<S>): number[];
  // Precondiciones + resumen. Lanza ArgsInvalidos con un mensaje accionable.
  preparar(args: z.infer<S>, ctx: ContextoCopiloto): Promise<Preparacion>;
  // Estado de la entidad, barato de calcular; se compara al confirmar con el
  // guardado al proponer para no ejecutar sobre algo que cambió en medio.
  huella(args: z.infer<S>, ctx: ContextoCopiloto, ejecucion?: unknown): Promise<string | null>;
  // Llama la server action existente y traduce su resultado.
  ejecutar(
    args: z.infer<S>,
    datos: z.infer<D>,
    ctx: ContextoCopiloto,
    ejecucion?: unknown,
  ): Promise<ResultadoEjecucion>;
};

// Forma homogénea para el registro (sin genéricos), como `Tool`.
export type Accion = {
  nombre: string;
  descripcion: string;
  roles: readonly Rol[];
  args: z.ZodType;
  datosConfirmacion: z.ZodType;
  procedencia(args: unknown): number[];
  preparar(args: unknown, ctx: ContextoCopiloto): Promise<Preparacion>;
  huella(args: unknown, ctx: ContextoCopiloto, ejecucion?: unknown): Promise<string | null>;
  ejecutar(args: unknown, datos: unknown, ctx: ContextoCopiloto, ejecucion?: unknown): Promise<ResultadoEjecucion>;
};

// El rol no está en `roles`. Tipado aparte del Error genérico de definirTool
// para que el route conteste 403 (y el runner is_error), no 500.
export class AccionNoPermitida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "AccionNoPermitida";
  }
}

/**
 * Igual que definirTool: valida rol y args en CADA llamada, venga de donde
 * venga (modelo, modo directo, confirmación), sin confiar en que el registro
 * ya filtró.
 */
export function definirAccion<S extends z.ZodType, D extends z.ZodType = z.ZodUndefined>(
  def: DefinicionAccion<S, D>,
): Accion {
  const datosSchema: z.ZodType = def.datosConfirmacion ?? z.undefined();
  const exigirRol = (ctx: ContextoCopiloto) => {
    if (!def.roles.includes(ctx.rol)) {
      throw new AccionNoPermitida(`La acción ${def.nombre} no está disponible para el rol ${ctx.rol}.`);
    }
  };
  return {
    nombre: def.nombre,
    descripcion: def.descripcion,
    roles: def.roles,
    args: def.args,
    datosConfirmacion: datosSchema,
    procedencia(args) {
      return def.procedencia ? def.procedencia(def.args.parse(args)) : [];
    },
    preparar(args, ctx) {
      exigirRol(ctx);
      return def.preparar(def.args.parse(args), ctx);
    },
    huella(args, ctx, ejecucion) {
      exigirRol(ctx);
      return def.huella(def.args.parse(args), ctx, ejecucion);
    },
    ejecutar(args, datos, ctx, ejecucion) {
      exigirRol(ctx);
      return def.ejecutar(def.args.parse(args), datosSchema.parse(datos) as z.infer<D>, ctx, ejecucion);
    },
  };
}
