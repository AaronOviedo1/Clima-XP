import { z } from "zod";
import { fechaDesdeInput, inputDesdeFecha } from "@/lib/fechas";

// Helpers que comparten las tools (args y formato). Sin queries.

// "yyyy-mm-dd" y además un día que exista: "2026-02-30" pasa la regex pero Date
// lo corre a marzo, y el round-trip lo delata. Ojo: en zod 4 el refine corre
// aunque la regex haya fallado, y "2026-13-45" pasa la regex; en ambos casos
// Date es inválida y `toISOString()` lanzaría (500 en vez de 400), de ahí la guarda.
export function esFechaCalendario(s: string): boolean {
  const d = fechaDesdeInput(s);
  return !Number.isNaN(d.getTime()) && inputDesdeFecha(d) === s;
}

export const fechaArg = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha va como yyyy-mm-dd.")
  .refine(esFechaCalendario, "Esa fecha no existe en el calendario.");

// Días de calendario de `desde` a `hasta` (ambos "yyyy-mm-dd"); negativo si
// `hasta` es anterior. Se compara por componentes UTC para no arrastrar horas.
export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00.000Z`).getTime();
  const b = new Date(`${hasta}T00:00:00.000Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function recortar(texto: string, largo: number): string {
  return texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto;
}

// "2 × Eco-Fresco · 1 × Turbo-Frío"
export function textoEquipos(equipos: { nombre: string; cantidad: number }[]): string {
  return equipos.map((e) => `${e.cantidad} × ${e.nombre}`).join(" · ");
}
