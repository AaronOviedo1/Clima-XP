import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";

export const TZ_NEGOCIO = "America/Hermosillo"; // sin horario de verano

// Las fechas de renta son @db.Date. Para evitar corrimientos por zona horaria
// se construyen/leen a mediodía UTC (fecha "pura", sin componente de hora local).
export function fechaDesdeInput(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T12:00:00.000Z`);
}

export function inputDesdeFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

// Días de renta entre entrega (inicio) y recolección (fin). Mínimo 1.
export function diasDeRenta(inicio: Date, fin: Date): number {
  return Math.max(1, differenceInCalendarDays(fin, inicio));
}

export function fechaLarga(fecha: Date): string {
  return format(fecha, "EEEE d 'de' MMMM yyyy", { locale: es });
}

export function fechaCorta(fecha: Date): string {
  return format(fecha, "d MMM yyyy", { locale: es });
}

// Fecha de hoy en la zona del negocio, como "yyyy-mm-dd".
export function hoyNegocio(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ_NEGOCIO }).format(new Date());
}

// Suma días a una fecha "yyyy-mm-dd" y devuelve "yyyy-mm-dd".
export function sumarDiasInput(yyyyMmDd: string, dias: number): string {
  const d = new Date(`${yyyyMmDd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
