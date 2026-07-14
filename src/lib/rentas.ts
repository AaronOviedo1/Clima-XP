import type { Prisma } from "@prisma/client";
import { diasDeRenta } from "@/lib/fechas";

// Include estándar para el detalle de una renta.
export const rentaInclude = {
  cliente: true,
  repartidor: true,
  unidades: { include: { unidad: { include: { modelo: true } } } },
  accesorios: { include: { accesorio: true } },
  pagos: { orderBy: { fecha: "desc" } },
} satisfies Prisma.RentaInclude;

export type RentaCompleta = Prisma.RentaGetPayload<{ include: typeof rentaInclude }>;

// Selects ligeros para listas: solo lo que consumen RentaListItem / DashboardCard
// (el include completo dispara una query por relación contra la BD remota).
const rentaListaScalars = {
  id: true,
  estado: true,
  fechaInicio: true,
  fechaFin: true,
  costoDomicilio: true,
  descuentoMonto: true,
} satisfies Prisma.RentaSelect;

// El modelo de cada unidad se trae para poder decir QUÉ se rentó, no solo cuántos.
const unidadConModelo = {
  select: { nombre: true, tipo: true },
} satisfies Prisma.ModeloEquipoDefaultArgs;

export const rentaListSelect = {
  ...rentaListaScalars,
  cliente: { select: { nombre: true } },
  unidades: {
    select: { precioDia: true, unidad: { select: { modelo: unidadConModelo } } },
  },
  accesorios: { select: { cargo: true } },
  pagos: { select: { monto: true, tipo: true, pagado: true } },
} satisfies Prisma.RentaSelect;
export type RentaLista = Prisma.RentaGetPayload<{ select: typeof rentaListSelect }>;

// Superset para las tarjetas del dashboard y la ruta.
export const rentaTarjetaSelect = {
  ...rentaListaScalars,
  direccion: true,
  lat: true,
  lng: true,
  ventanaEntrega: true,
  cliente: { select: { nombre: true, telefono: true } },
  unidades: {
    select: {
      precioDia: true,
      unidad: { select: { codigo: true, modelo: unidadConModelo } },
    },
  },
  accesorios: { select: { cargo: true } },
  pagos: { select: { monto: true, tipo: true, pagado: true } },
} satisfies Prisma.RentaSelect;
export type RentaTarjeta = Prisma.RentaGetPayload<{ select: typeof rentaTarjetaSelect }>;

// Forma mínima que necesita totalesDeRenta; la satisfacen RentaCompleta,
// RentaLista y RentaTarjeta.
export type RentaParaTotales = {
  estado: string;
  fechaInicio: Date;
  fechaFin: Date;
  costoDomicilio: number;
  descuentoMonto: number;
  unidades: { precioDia: number }[];
  accesorios: { cargo: number }[];
  pagos: { monto: number; tipo: string; pagado: boolean }[];
};

// Qué se rentó, agrupado por modelo: [{ nombre: "Eco-Fresco", cantidad: 2 }].
// La satisfacen RentaCompleta, RentaLista y RentaTarjeta.
export type UnidadConModelo = { unidad: { modelo: { nombre: string } } };

export function equiposPorModelo(
  unidades: UnidadConModelo[]
): { nombre: string; cantidad: number }[] {
  const conteo = new Map<string, number>();
  for (const u of unidades) {
    const nombre = u.unidad.modelo.nombre;
    conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
  }
  return [...conteo]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre));
}

export type TotalesRenta = {
  dias: number;
  subtotalEquipos: number;
  subtotalAccesorios: number;
  costoDomicilio: number;
  descuentoMonto: number;
  total: number;
  pagadoConfirmado: number; // neto de reembolsos
  saldo: number;
};

// Un pago REEMBOLSO resta; los demás suman (solo si pagado=true).
function montoNeto(p: { monto: number; tipo: string; pagado: boolean }): number {
  if (!p.pagado) return 0;
  return p.tipo === "REEMBOLSO" ? -p.monto : p.monto;
}

export function totalesDeRenta(renta: RentaParaTotales): TotalesRenta {
  const dias = diasDeRenta(renta.fechaInicio, renta.fechaFin);
  const subtotalEquipos = renta.unidades.reduce(
    (acc, ru) => acc + ru.precioDia * dias,
    0,
  );
  const subtotalAccesorios = renta.accesorios.reduce(
    (acc, ra) => acc + ra.cargo,
    0,
  );
  const total = Math.max(
    0,
    subtotalEquipos +
      subtotalAccesorios +
      renta.costoDomicilio -
      renta.descuentoMonto,
  );
  const pagadoConfirmado = renta.pagos.reduce((acc, p) => acc + montoNeto(p), 0);
  // Una renta cancelada no genera cobro: lo que no se haya pagado ya no se debe
  // (si hubo anticipo, sigue como pagado; para regresarlo se registra un reembolso).
  const saldo = renta.estado === "CANCELADA" ? 0 : total - pagadoConfirmado;

  return {
    dias,
    subtotalEquipos,
    subtotalAccesorios,
    costoDomicilio: renta.costoDomicilio,
    descuentoMonto: renta.descuentoMonto,
    total,
    pagadoConfirmado,
    saldo,
  };
}

// Metadatos de presentación por estado.
export const ESTADO_RENTA_META: Record<
  string,
  { label: string; badge: "default" | "secondary" | "destructive" | "outline" }
> = {
  COTIZADA: { label: "Cotizada", badge: "outline" },
  CONFIRMADA: { label: "Confirmada", badge: "secondary" },
  EN_RUTA: { label: "En ruta", badge: "default" },
  ENTREGADA: { label: "Entregada", badge: "default" },
  RECOGIDA: { label: "Recogida", badge: "secondary" },
  CONCLUIDA: { label: "Concluida", badge: "outline" },
  CANCELADA: { label: "Cancelada", badge: "destructive" },
};

export const ESTADOS_RENTA = [
  "COTIZADA",
  "CONFIRMADA",
  "EN_RUTA",
  "ENTREGADA",
  "RECOGIDA",
  "CONCLUIDA",
  "CANCELADA",
] as const;
export type EstadoRentaStr = (typeof ESTADOS_RENTA)[number];

// Transiciones de estado permitidas (compartidas por el server action y la UI).
export const TRANSICIONES: Record<EstadoRentaStr, EstadoRentaStr[]> = {
  COTIZADA: ["CONFIRMADA", "CANCELADA"],
  CONFIRMADA: ["EN_RUTA", "CANCELADA"],
  EN_RUTA: ["ENTREGADA", "CANCELADA"],
  ENTREGADA: ["RECOGIDA"],
  RECOGIDA: ["CONCLUIDA"],
  CONCLUIDA: [],
  CANCELADA: [],
};

// La información de cualquier renta se puede corregir (incluidas las cerradas:
// las 482 migradas del Excel llegaron como CONCLUIDA/CANCELADA). Lo único que
// se congela son las unidades una vez que el equipo salió a la calle: de EN_RUTA
// en adelante solo se ajustan fechas, datos y cargos.
export const ESTADOS_EDITABLES: EstadoRentaStr[] = [...ESTADOS_RENTA];
export const UNIDADES_BLOQUEADAS: EstadoRentaStr[] = [
  "EN_RUTA",
  "ENTREGADA",
  "RECOGIDA",
  "CONCLUIDA",
  "CANCELADA",
];

// Estados cerrados: la renta ya no aparta inventario (ver ESTADOS_ACTIVOS en
// disponibilidad.ts), así que mover sus fechas no puede chocar con nadie.
export const ESTADOS_CERRADOS: EstadoRentaStr[] = ["RECOGIDA", "CONCLUIDA", "CANCELADA"];

// Estados que cuentan como "ya atendida" para las secciones del dashboard:
// una entrega de hoy ya hecha (o recolección) sigue visible, marcada como lista.
export const ENTREGA_HECHA: EstadoRentaStr[] = ["ENTREGADA", "RECOGIDA", "CONCLUIDA"];
export const RECOLECCION_HECHA: EstadoRentaStr[] = ["RECOGIDA", "CONCLUIDA"];

// Texto del botón de acción para cada transición destino.
export const ACCION_ESTADO: Record<EstadoRentaStr, string> = {
  COTIZADA: "Cotizar",
  CONFIRMADA: "Confirmar",
  EN_RUTA: "En ruta",
  ENTREGADA: "Entregado",
  RECOGIDA: "Recogido",
  CONCLUIDA: "Concluir",
  CANCELADA: "Cancelar",
};
