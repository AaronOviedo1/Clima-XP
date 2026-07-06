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

export function totalesDeRenta(renta: RentaCompleta): TotalesRenta {
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

  return {
    dias,
    subtotalEquipos,
    subtotalAccesorios,
    costoDomicilio: renta.costoDomicilio,
    descuentoMonto: renta.descuentoMonto,
    total,
    pagadoConfirmado,
    saldo: total - pagadoConfirmado,
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
