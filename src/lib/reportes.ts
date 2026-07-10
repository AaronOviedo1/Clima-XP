import { prisma } from "@/lib/prisma";
import { rentaInclude, totalesDeRenta } from "@/lib/rentas";
import { diasDeRenta } from "@/lib/fechas";

// Nota: los pagos históricos migrados tienen fecha = fecha de migración, así que
// para agrupar por periodo se usa renta.fechaInicio (la fecha real del servicio).

export type PeriodoReporte = number | "todos";

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Estados que cuentan como negocio real (excluye COTIZADA y CANCELADA).
const ESTADOS_NEGOCIO = ["CONFIRMADA", "EN_RUTA", "ENTREGADA", "RECOGIDA", "CONCLUIDA"] as const;
const ESTADOS_ACTIVOS = ["CONFIRMADA", "EN_RUTA", "ENTREGADA", "RECOGIDA"];

export type Serie = { label: string; valor: number; sub?: string }[];

export type Reportes = {
  aniosDisponibles: number[];
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
  porZona: Serie; // domicilio por tramo de km
};

export async function generarReportes(periodo: PeriodoReporte): Promise<Reportes> {
  const rentas = await prisma.renta.findMany({
    where: { estado: { in: [...ESTADOS_NEGOCIO] } },
    include: rentaInclude,
    orderBy: { fechaInicio: "asc" },
  });

  const aniosSet = new Set<number>();
  for (const r of rentas) aniosSet.add(r.fechaInicio.getUTCFullYear());
  const aniosDisponibles = [...aniosSet].sort((a, b) => b - a);

  const enPeriodo = rentas.filter(
    (r) => periodo === "todos" || r.fechaInicio.getUTCFullYear() === periodo,
  );

  let ingresos = 0;
  let facturado = 0;
  let porCobrar = 0;
  const ingresosPeriodoMap = new Map<string, number>();
  let aero = 0;
  let cal = 0;
  let rentasAero = 0;
  let rentasCal = 0;
  const metodoMap = new Map<string, number>();
  const clienteMap = new Map<string, { nombre: string; monto: number }>();
  const unidadMap = new Map<string, number>();
  const zonaMap = new Map<number, number>();

  for (const r of enPeriodo) {
    const t = totalesDeRenta(r);
    const dias = diasDeRenta(r.fechaInicio, r.fechaFin);
    ingresos += t.pagadoConfirmado;
    facturado += t.total;
    if (t.saldo > 0 && ESTADOS_ACTIVOS.includes(r.estado)) porCobrar += t.saldo;

    // Ingresos por periodo (mes si año fijo; año si "todos")
    const clave =
      periodo === "todos"
        ? String(r.fechaInicio.getUTCFullYear())
        : MESES_CORTOS[r.fechaInicio.getUTCMonth()];
    ingresosPeriodoMap.set(clave, (ingresosPeriodoMap.get(clave) ?? 0) + t.pagadoConfirmado);

    // Aerocooler vs calentón (ingreso de equipo por tipo)
    let tieneAero = false;
    let tieneCal = false;
    for (const ru of r.unidades) {
      const rev = ru.precioDia * dias;
      if (ru.unidad.modelo.tipo === "CALENTON") { cal += rev; tieneCal = true; }
      else { aero += rev; tieneAero = true; }
      unidadMap.set(ru.unidad.codigo, (unidadMap.get(ru.unidad.codigo) ?? 0) + 1);
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
  }

  // Ordenar ingresos por periodo cronológicamente
  const ingresosPorPeriodo: Serie =
    periodo === "todos"
      ? [...ingresosPeriodoMap.entries()]
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([label, valor]) => ({ label, valor }))
      : MESES_CORTOS.filter((m) => ingresosPeriodoMap.has(m)).map((m) => ({
          label: m,
          valor: ingresosPeriodoMap.get(m)!,
        }));

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

  const porZona: Serie = [...zonaMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([km, valor]) => ({ label: `${km} km`, valor }));

  const numRentas = enPeriodo.length;

  return {
    aniosDisponibles,
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
    porZona,
  };
}
