// Cargo por día festivo — lógica pura, compartida por el formulario (vista
// previa), las server actions, la hoja de cotización y el copiloto. Módulo
// neutro (sin prisma ni "server-only"): lo importa también el cliente. La
// config (qué días y cuánto) se lee de BD en obtenerFestivos(), en
// lib/configuracion.ts.
//
// Regla: se cobra `montoPorEquipo` por cada equipo y por cada día festivo que
// la renta OCUPA. La ocupación es fin-exclusiva, como en todo el sistema
// (condicionTraslape): una renta del 24 al 25 ocupa solo el 24 → un festivo; del
// 24 al 26 son dos; del 31 al 1 es uno. Una renta del mismo día ocupa ese día.
//
// Los festivos son "MM-DD" recurrentes: valen todos los años.

export type ConfigFestivos = {
  fechas: string[]; // "MM-DD"
  montoPorEquipo: number; // pesos enteros
};

export const FESTIVOS_DEFAULT = ["12-24", "12-25", "12-31", "01-01"];
export const CARGO_FESTIVO_DEFAULT = 100;

export const CONFIG_FESTIVOS_DEFAULT: ConfigFestivos = {
  fechas: FESTIVOS_DEFAULT,
  montoPorEquipo: CARGO_FESTIVO_DEFAULT,
};

const DIAS_POR_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIA_MS = 86_400_000;

// "MM-DD" que existe en algún año (29 de febrero incluido).
export function festivoValido(mmdd: string): boolean {
  const m = /^(\d{2})-(\d{2})$/.exec(mmdd);
  if (!m) return false;
  const mes = Number(m[1]);
  const dia = Number(m[2]);
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= DIAS_POR_MES[mes - 1];
}

// Sin repetidos y en orden de temporada: de julio a junio, para que el 1 de
// enero quede después de diciembre y no al principio.
function claveTemporada(mmdd: string): string {
  const mes = Number(mmdd.slice(0, 2));
  return `${String(mes >= 7 ? mes : mes + 12).padStart(2, "0")}-${mmdd.slice(3)}`;
}
export function normalizarFestivos(fechas: string[]): string[] {
  return [...new Set(fechas.filter(festivoValido))].sort((a, b) =>
    claveTemporada(a).localeCompare(claveTemporada(b)),
  );
}

// "24 dic"
export function etiquetaFestivo(mmdd: string): string {
  const [mes, dia] = mmdd.split("-").map(Number);
  return `${dia} ${MESES_CORTOS[mes - 1]}`;
}

// Las fechas de renta son días de calendario: se leen con componentes UTC
// (Prisma devuelve @db.Date como medianoche UTC y el código las arma a mediodía
// UTC; ver lib/fechas.ts). Nunca hora local.
function diaUtc(fecha: Date): number {
  return Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
}

function mmddDe(ms: number): string {
  const d = new Date(ms);
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${mes}-${dia}`;
}

// Días festivos ("MM-DD", en orden de la renta) que ocupa [inicio, fin).
export function diasFestivosDeRenta(inicio: Date, fin: Date, festivos: string[]): string[] {
  const set = new Set(festivos);
  const desde = diaUtc(inicio);
  // Mínimo un día, igual que diasDeRenta: la renta del mismo día ocupa ese día.
  const hasta = Math.max(diaUtc(fin), desde + DIA_MS);
  const dias: string[] = [];
  for (let t = desde; t < hasta; t += DIA_MS) {
    const k = mmddDe(t);
    if (set.has(k)) dias.push(k);
  }
  return dias;
}

export type CargoFestivo = {
  dias: string[]; // "MM-DD" festivos que ocupa la renta
  numEquipos: number;
  montoPorEquipo: number;
  total: number; // dias × equipos × monto
};

export function cargoFestivoDe(
  inicio: Date,
  fin: Date,
  numEquipos: number,
  config: ConfigFestivos,
): CargoFestivo {
  const dias = diasFestivosDeRenta(inicio, fin, config.fechas);
  const monto = Math.max(0, Math.round(config.montoPorEquipo || 0));
  return {
    dias,
    numEquipos,
    montoPorEquipo: monto,
    total: dias.length * Math.max(0, numEquipos) * monto,
  };
}

// "24 dic" / "24 dic y 31 dic" / "24 dic, 25 dic y 31 dic"
export function etiquetaDiasFestivos(dias: string[]): string {
  const e = dias.map(etiquetaFestivo);
  if (e.length <= 1) return e.join("");
  return `${e.slice(0, -1).join(", ")} y ${e[e.length - 1]}`;
}
