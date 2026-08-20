import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { totalesDeRenta } from "@/lib/rentas";
import { claveSemana, diasDeRenta, inicioSemana, rangoSemana } from "@/lib/fechas";

// Solo los campos que consume la agregación: el reporte recorre todo el
// histórico y con el include completo el payload crece sin límite.
const reporteSelect = {
  id: true,
  estado: true,
  clienteId: true,
  fechaInicio: true,
  fechaFin: true,
  costoDomicilio: true,
  descuentoMonto: true,
  distanciaKm: true,
  cliente: { select: { nombre: true } },
  unidades: {
    select: {
      precioDia: true,
      unidad: { select: { codigo: true, modelo: { select: { tipo: true, nombre: true } } } },
    },
  },
  accesorios: { select: { cargo: true } },
  pagos: { select: { monto: true, tipo: true, pagado: true, metodo: true } },
} satisfies Prisma.RentaSelect;

// Nota: los pagos históricos migrados tienen fecha = fecha de migración, así que
// para agrupar por periodo se usa renta.fechaInicio (la fecha real del servicio).

/**
 * El periodo es jerárquico: sin año no hay mes, y sin mes no hay semana. Así el
 * filtro se lee igual que se usa (2026 → agosto → la semana del 3) y basta un
 * objeto para saber en qué nivel está parado.
 *
 * La semana es el lunes en `yyyy-mm-dd` (mismas semanas lunes–domingo que la
 * lista de rentas y el calendario). Una semana puede cruzar el fin de mes: se
 * filtra la semana **completa**, aunque un par de días caigan en el mes vecino.
 */
export type PeriodoReporte = {
  anio: number | null;
  mes: number | null; // 1–12
  semana: string | null; // lunes, "yyyy-mm-dd"
};

export const PERIODO_TODOS: PeriodoReporte = { anio: null, mes: null, semana: null };

/** Lee `?anio=&mes=&semana=` respetando la jerarquía (un mes suelto se ignora). */
export function periodoDesdeParams(sp: {
  anio?: string;
  mes?: string;
  semana?: string;
}): PeriodoReporte {
  const anio = sp.anio && /^\d{4}$/.test(sp.anio) ? Number(sp.anio) : null;
  if (anio == null) return PERIODO_TODOS;

  const n = sp.mes && /^\d{1,2}$/.test(sp.mes) ? Number(sp.mes) : null;
  const mes = n != null && n >= 1 && n <= 12 ? n : null;
  if (mes == null) return { anio, mes: null, semana: null };

  const semana = sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : null;
  return { anio, mes, semana };
}

export function hrefPeriodo(p: PeriodoReporte): string {
  if (p.anio == null) return "/reportes";
  const qs = new URLSearchParams({ anio: String(p.anio) });
  if (p.mes != null) qs.set("mes", String(p.mes));
  if (p.semana) qs.set("semana", p.semana);
  return `/reportes?${qs}`;
}

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_LARGOS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function nombreMes(mes: number, largo = false): string {
  return (largo ? MESES_LARGOS : MESES_CORTOS)[mes - 1] ?? "";
}

/** Etiqueta corta de una semana para los chips: "3–9", "29–5" si cruza mes. */
export function etiquetaSemanaCorta(lunes: string): string {
  const l = new Date(`${lunes}T12:00:00.000Z`);
  const d = new Date(l);
  d.setUTCDate(d.getUTCDate() + 6);
  return `${l.getUTCDate()}–${d.getUTCDate()}`;
}

// ¿La fecha de entrega de la renta cae dentro del periodo elegido?
function caeEnPeriodo(fecha: Date, p: PeriodoReporte): boolean {
  if (p.anio == null) return true;
  if (p.semana) return claveSemana(fecha) === p.semana;
  if (p.mes != null)
    return fecha.getUTCFullYear() === p.anio && fecha.getUTCMonth() + 1 === p.mes;
  return fecha.getUTCFullYear() === p.anio;
}

// El periodo con el que se compara en la tendencia del hero: el anterior del
// mismo tamaño (año pasado, mes pasado, semana pasada). "Todos" no compara.
function periodoAnterior(p: PeriodoReporte): { periodo: PeriodoReporte; label: string } | null {
  if (p.anio == null) return null;
  if (p.semana) {
    const l = new Date(`${p.semana}T12:00:00.000Z`);
    l.setUTCDate(l.getUTCDate() - 7);
    return {
      periodo: { anio: p.anio, mes: p.mes, semana: l.toISOString().slice(0, 10) },
      label: "vs semana anterior",
    };
  }
  if (p.mes != null) {
    const anio = p.mes === 1 ? p.anio - 1 : p.anio;
    const mes = p.mes === 1 ? 12 : p.mes - 1;
    // Enero compara contra diciembre del año pasado: ahí el año sí se dice.
    const nombre = nombreMes(mes, true).toLowerCase();
    return {
      periodo: { anio, mes, semana: null },
      label: `vs ${anio === p.anio ? nombre : `${nombre} ${anio}`}`,
    };
  }
  return { periodo: { anio: p.anio - 1, mes: null, semana: null }, label: `vs ${p.anio - 1}` };
}

// En qué barra de la gráfica cae la renta. La granularidad baja con el periodo:
// histórico → años, año → meses, mes → semanas, semana → días.
function barraDe(fecha: Date, p: PeriodoReporte): { clave: string; label: string; orden: number } {
  if (p.anio == null) {
    const y = fecha.getUTCFullYear();
    return { clave: `y${y}`, label: String(y), orden: y };
  }
  if (p.semana) {
    const d = fecha.getUTCDay();
    return { clave: `d${d}`, label: DIAS_CORTOS[d], orden: d === 0 ? 7 : d }; // lunes primero
  }
  if (p.mes != null) {
    const lunes = inicioSemana(fecha);
    const clave = lunes.toISOString().slice(0, 10);
    return { clave, label: etiquetaSemanaCorta(clave), orden: lunes.getTime() };
  }
  const m = fecha.getUTCMonth();
  return { clave: `m${m}`, label: MESES_CORTOS[m], orden: m };
}

/** "Histórico" · "2026" · "Agosto 2026" · "3 – 9 ago 2026" (hero y encabezados). */
export function etiquetaPeriodo(p: PeriodoReporte): string {
  if (p.anio == null) return "Histórico";
  if (p.semana) return rangoSemana(new Date(`${p.semana}T12:00:00.000Z`));
  if (p.mes != null) return `${nombreMes(p.mes, true)} ${p.anio}`;
  return String(p.anio);
}

/** Título de la gráfica de ingresos, según la granularidad del periodo. */
function tituloSerie(p: PeriodoReporte): string {
  if (p.anio == null) return "Ingresos por año";
  if (p.semana) return "Ingresos por día";
  if (p.mes != null) return "Ingresos por semana";
  return "Ingresos por mes";
}

// Estados que cuentan como negocio real (excluye COTIZADA y CANCELADA).
const ESTADOS_NEGOCIO = ["CONFIRMADA", "EN_RUTA", "ENTREGADA", "RECOGIDA", "CONCLUIDA"] as const;
const ESTADOS_ACTIVOS = ["CONFIRMADA", "EN_RUTA", "ENTREGADA", "RECOGIDA"];

export type Serie = { label: string; valor: number; sub?: string }[];

export type Reportes = {
  // Qué se puede elegir en cada nivel del filtro. Solo se ofrecen periodos con
  // rentas: el negocio es de temporada y la mitad de los meses saldrían vacíos.
  aniosDisponibles: number[];
  mesesDisponibles: number[]; // 1–12, del año elegido
  semanasDisponibles: string[]; // lunes, del mes elegido
  etiqueta: string; // "Agosto 2026"
  tituloSerie: string; // "Ingresos por semana"
  kpis: {
    ingresos: number;
    facturado: number;
    numRentas: number;
    ticketPromedio: number;
    porCobrar: number;
  };
  ingresosPorPeriodo: Serie; // por mes si hay año; por año si "todos"
  porTipo: { aerocooler: number; calenton: number; rentasAero: number; rentasCal: number };
  porMetodo: Serie;
  topClientes: Serie;
  utilizacion: Serie; // rentas por unidad
  utilizacionModelo: Serie; // rentas por modelo (sub = tipo)
  porZona: Serie; // domicilio por tramo de km
  domicilio: { km: number; ingresos: number; recorridos: number };
  tendencia: { mostrar: boolean; pct: number; sube: boolean; label: string };
};

// `scope`: condiciones extra que lleva la query (el copiloto pasa su scope de
// negocio; la pantalla de reportes no manda nada).
export async function generarReportes(
  periodo: PeriodoReporte,
  scope: Prisma.RentaWhereInput = {},
): Promise<Reportes> {
  const rentas = await prisma.renta.findMany({
    relationLoadStrategy: "join", // 1 solo round-trip a la BD remota
    where: { ...scope, estado: { in: [...ESTADOS_NEGOCIO] } },
    select: reporteSelect,
    orderBy: { fechaInicio: "asc" },
  });

  // Opciones del filtro: los años con rentas, los meses del año elegido y las
  // semanas del mes elegido (una semana entra si alguna renta suya cae en él).
  const aniosSet = new Set<number>();
  const mesesSet = new Set<number>();
  const semanasSet = new Set<string>();
  for (const r of rentas) {
    const f = r.fechaInicio;
    aniosSet.add(f.getUTCFullYear());
    if (periodo.anio != null && f.getUTCFullYear() === periodo.anio) {
      mesesSet.add(f.getUTCMonth() + 1);
      if (periodo.mes != null && f.getUTCMonth() + 1 === periodo.mes)
        semanasSet.add(claveSemana(f));
    }
  }
  const aniosDisponibles = [...aniosSet].sort((a, b) => b - a);
  const mesesDisponibles = [...mesesSet].sort((a, b) => a - b);
  const semanasDisponibles = [...semanasSet].sort();

  const enPeriodo = rentas.filter((r) => caeEnPeriodo(r.fechaInicio, periodo));

  let ingresos = 0;
  let facturado = 0;
  let porCobrar = 0;
  const ingresosPeriodoMap = new Map<string, { label: string; orden: number; valor: number }>();
  let aero = 0;
  let cal = 0;
  let rentasAero = 0;
  let rentasCal = 0;
  const metodoMap = new Map<string, number>();
  const clienteMap = new Map<string, { nombre: string; monto: number }>();
  const unidadMap = new Map<string, number>();
  const modeloMap = new Map<string, { nombre: string; tipo: string; count: number }>();
  const zonaMap = new Map<number, number>();
  let domIngresos = 0;
  let domKm = 0;
  let domRecorridos = 0;

  for (const r of enPeriodo) {
    const t = totalesDeRenta(r);
    const dias = diasDeRenta(r.fechaInicio, r.fechaFin);
    ingresos += t.pagadoConfirmado;
    facturado += t.total;
    if (t.saldo > 0 && ESTADOS_ACTIVOS.includes(r.estado)) porCobrar += t.saldo;

    // Ingresos por barra (año / mes / semana / día, según el periodo)
    const b = barraDe(r.fechaInicio, periodo);
    const acum = ingresosPeriodoMap.get(b.clave) ?? { label: b.label, orden: b.orden, valor: 0 };
    acum.valor += t.pagadoConfirmado;
    ingresosPeriodoMap.set(b.clave, acum);

    // Aerocooler vs calentón (ingreso de equipo por tipo)
    let tieneAero = false;
    let tieneCal = false;
    for (const ru of r.unidades) {
      const rev = ru.precioDia * dias;
      const { tipo, nombre } = ru.unidad.modelo;
      if (tipo === "CALENTON") { cal += rev; tieneCal = true; }
      else { aero += rev; tieneAero = true; }
      unidadMap.set(ru.unidad.codigo, (unidadMap.get(ru.unidad.codigo) ?? 0) + 1);
      const mm = modeloMap.get(nombre) ?? { nombre, tipo, count: 0 };
      mm.count += 1;
      modeloMap.set(nombre, mm);
    }
    if (tieneAero) rentasAero++;
    if (tieneCal) rentasCal++;

    // Método de pago
    for (const p of r.pagos) {
      if (p.pagado && p.tipo !== "REEMBOLSO")
        metodoMap.set(p.metodo, (metodoMap.get(p.metodo) ?? 0) + p.monto);
    }

    // Top clientes (por ingreso)
    const c = clienteMap.get(r.clienteId) ?? { nombre: r.cliente.nombre, monto: 0 };
    c.monto += t.pagadoConfirmado;
    clienteMap.set(r.clienteId, c);

    // Ingresos por zona (domicilio por tramo de km, donde hay distancia)
    if (r.distanciaKm != null && r.distanciaKm > 0 && r.costoDomicilio > 0) {
      const km = Math.ceil(r.distanciaKm);
      zonaMap.set(km, (zonaMap.get(km) ?? 0) + r.costoDomicilio);
    }

    // Totales de domicilio (para los KPI de la vista móvil)
    if (r.costoDomicilio > 0) {
      domIngresos += r.costoDomicilio;
      domRecorridos += 1;
      if (r.distanciaKm != null && r.distanciaKm > 0) domKm += r.distanciaKm;
    }
  }

  // Tendencia contra el periodo anterior del mismo tamaño (solo si hubo negocio
  // entonces: comparar contra cero no dice nada).
  const previo = periodoAnterior(periodo);
  let facturadoPrev = 0;
  if (previo) {
    for (const r of rentas) {
      if (caeEnPeriodo(r.fechaInicio, previo.periodo)) facturadoPrev += totalesDeRenta(r).total;
    }
  }
  const tendenciaMostrar = previo != null && facturadoPrev > 0;
  const tendenciaPct = tendenciaMostrar
    ? Math.round(((facturado - facturadoPrev) / facturadoPrev) * 100)
    : 0;

  const ingresosPorPeriodo: Serie = [...ingresosPeriodoMap.values()]
    .sort((a, b) => a.orden - b.orden)
    .map(({ label, valor }) => ({ label, valor }));

  const METODO_LABEL: Record<string, string> = {
    EFECTIVO: "Efectivo",
    TRANSFERENCIA: "Transferencia",
    LINK_MERCADO_PAGO: "Mercado Pago",
    OTRO: "Otro",
  };
  const porMetodo: Serie = [...metodoMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m, valor]) => ({ label: METODO_LABEL[m] ?? m, valor }));

  const topClientes: Serie = [...clienteMap.values()]
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 10)
    .map((c) => ({ label: c.nombre, valor: c.monto }));

  const utilizacion: Serie = [...unidadMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([codigo, n]) => ({ label: codigo, valor: n, sub: `${n} rentas` }));

  const utilizacionModelo: Serie = [...modeloMap.values()]
    .sort((a, b) => b.count - a.count)
    .map((m) => ({ label: m.nombre, valor: m.count, sub: m.tipo }));

  const porZona: Serie = [...zonaMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([km, valor]) => ({ label: `${km} km`, valor }));

  const numRentas = enPeriodo.length;

  return {
    aniosDisponibles,
    mesesDisponibles,
    semanasDisponibles,
    etiqueta: etiquetaPeriodo(periodo),
    tituloSerie: tituloSerie(periodo),
    kpis: {
      ingresos,
      facturado,
      numRentas,
      ticketPromedio: numRentas ? Math.round(ingresos / numRentas) : 0,
      porCobrar,
    },
    ingresosPorPeriodo,
    porTipo: { aerocooler: aero, calenton: cal, rentasAero, rentasCal },
    porMetodo,
    topClientes,
    utilizacion,
    utilizacionModelo,
    porZona,
    domicilio: { km: Math.round(domKm), ingresos: domIngresos, recorridos: domRecorridos },
    tendencia: {
      mostrar: tendenciaMostrar,
      pct: tendenciaPct,
      sube: tendenciaPct >= 0,
      label: previo?.label ?? "",
    },
  };
}
