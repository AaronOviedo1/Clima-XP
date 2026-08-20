import type { Rol } from "@prisma/client";
import type { z } from "zod";
import type { ContextoCopiloto } from "./contexto";

/**
 * Contrato de una tool del copiloto. Solo lectura. El modelo controla
 * únicamente `args` (validados con zod — usar `z.strictObject`, para que una
 * clave inventada se rechace y no se descarte en silencio); el contexto llega
 * de la sesión.
 * Todo número que devuelva (conteos, sumas, promedios) viene ya calculado
 * por la query o por la función del servidor: el modelo solo redacta.
 */
export type DefinicionTool<S extends z.ZodType, R> = {
  nombre: string; // snake_case: es el nombre que ve el modelo y el de /api/copiloto
  descripcion: string; // para el modelo: qué responde y cuándo usarla
  roles: readonly Rol[]; // si el rol no está aquí, la tool no existe para ese usuario
  args: S;
  ejecutar(args: z.infer<S>, ctx: ContextoCopiloto): Promise<R>;
};

/**
 * Error de argumentos que solo se detecta ya con el contexto (p. ej. un rango
 * cuyos defaults dependen de `ctx.hoy`) o que zod no expresa bien. El route
 * handler lo convierte en 400 y el runner (paso 3) se lo regresa al modelo como
 * error de la tool para que corrija la llamada. Cualquier otra excepción es 500.
 */
export class ArgsInvalidos extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ArgsInvalidos";
  }
}

// Forma homogénea para el registro (sin genéricos).
export type Tool = {
  nombre: string;
  descripcion: string;
  roles: readonly Rol[];
  args: z.ZodType;
  ejecutar(args: unknown, ctx: ContextoCopiloto): Promise<unknown>;
};

/**
 * `ejecutar` valida los args con su schema y el rol con `roles` en cada
 * llamada, venga de donde venga (modo directo, modelo): el registro ya filtra
 * por rol, pero la tool no confía en que la hayan filtrado.
 */
export function definirTool<S extends z.ZodType, R>(def: DefinicionTool<S, R>): Tool {
  return {
    nombre: def.nombre,
    descripcion: def.descripcion,
    roles: def.roles,
    args: def.args,
    ejecutar(args, ctx) {
      if (!def.roles.includes(ctx.rol)) {
        throw new Error(`La tool ${def.nombre} no está disponible para el rol ${ctx.rol}.`);
      }
      return def.ejecutar(def.args.parse(args), ctx);
    },
  };
}
