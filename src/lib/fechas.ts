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

// Las fechas de renta son días de calendario, no instantes. Prisma devuelve las
// columnas @db.Date como medianoche UTC, y date-fns formatea en la zona local:
// en Hermosillo (UTC−7) esa medianoche cae a las 17:00 del día ANTERIOR, así que
// formatear directo corre la fecha un día. Se reconstruye el día usando los
// componentes UTC, que es el día real tanto para lo que llega de la BD (00:00Z)
// como para lo que crea el propio código (fechaDesdeInput, a mediodía UTC).
function diaCalendario(fecha: Date): Date {
  return new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
}

// Días de renta entre entrega (inicio) y recolección (fin). Mínimo 1.
export function diasDeRenta(inicio: Date, fin: Date): number {
  return Math.max(
    1,
    differenceInCalendarDays(diaCalendario(fin), diaCalendario(inicio))
  );
}

export function fechaLarga(fecha: Date): string {
  return format(diaCalendario(fecha), "EEEE d 'de' MMMM yyyy", { locale: es });
}

export function fechaCorta(fecha: Date): string {
  return format(diaCalendario(fecha), "d MMM yyyy", { locale: es });
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

// Valida un "yyyy-mm-dd" de un query param (p. ej. ?fecha=); si falta o es
// inválido, regresa hoy.
export function fechaValida(fecha?: string): string {
  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  return hoyNegocio();
}

// --- Semanas (lunes a domingo) ---

// Lunes de la semana a la que pertenece la fecha (fecha pura, mediodía UTC).
export function inicioSemana(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getUTCDay(); // 0 = domingo
  d.setUTCDate(d.getUTCDate() + (dia === 0 ? -6 : 1 - dia));
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

export function claveSemana(fecha: Date): string {
  return inicioSemana(fecha).toISOString().slice(0, 10);
}

// Semanas completas entre dos fechas: 0 = misma semana, -1 = semana pasada, 1 = próxima.
export function diferenciaSemanas(fecha: Date, referencia: Date): number {
  const MS_SEMANA = 7 * 24 * 60 * 60 * 1000;
  return Math.round(
    (inicioSemana(fecha).getTime() - inicioSemana(referencia).getTime()) / MS_SEMANA
  );
}

// "6 – 12 jul 2026" (se omite lo repetido entre extremos: "29 jun – 5 jul 2026").
export function rangoSemana(lunes: Date): string {
  const domingo = new Date(lunes);
  domingo.setUTCDate(domingo.getUTCDate() + 6);
  const mismoAnio = lunes.getUTCFullYear() === domingo.getUTCFullYear();
  const mismoMes = mismoAnio && lunes.getUTCMonth() === domingo.getUTCMonth();
  const desde = format(lunes, mismoMes ? "d" : mismoAnio ? "d MMM" : "d MMM yyyy", {
    locale: es,
  });
  return `${desde} – ${format(domingo, "d MMM yyyy", { locale: es })}`;
}
