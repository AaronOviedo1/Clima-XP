import "server-only";
import { prisma } from "@/lib/prisma";
import { TZ_NEGOCIO, fechaCorta, inputDesdeFecha, sumarDiasInput } from "@/lib/fechas";
import { equiposPorModelo } from "@/lib/rentas";

/**
 * Integración con pasta stats, el panel financiero del dueño.
 *
 * Climaxpress es uno de los negocios que ese panel administra, y hasta ahora
 * los depósitos de las rentas le llegaban como entradas anónimas en el estado
 * de cuenta de Spin: un monto sin dueño. Aquí se le dice quién los mandó.
 *
 * Es un contrato propio, NO el schema de Prisma: pasta stats no toca esta base
 * y si mañana cambia un modelo de aquí, allá no se rompe nada. La copia gemela
 * del contrato vive en `lib/validations/climaxpress.ts` de pasta-stats — si
 * tocas uno, toca el otro.
 */

export type PagoExterno = {
  id: string;
  fecha: string; // YYYY-MM-DD, día local de Hermosillo: cuándo entró el dinero
  fecha_estimada: boolean; // true = se dedujo de la renta, no se capturó ese día
  monto: number; // pesos enteros; negativo en REEMBOLSO
  metodo: "EFECTIVO" | "TRANSFERENCIA" | "LINK_MERCADO_PAGO" | "OTRO";
  tipo: "ANTICIPO" | "LIQUIDACION" | "REEMBOLSO";
  renta_id: string;
  cliente: string | null;
  concepto: string;
};

/**
 * Marca que `scripts/migrate-excel.ts` deja en las notas de cada renta que
 * salió del Excel histórico. Sus pagos se crearon SIN `fecha`, así que
 * heredaron el `default(now())` del momento de la importación: los 471 quedaron
 * fechados el mismo día. Mandar esa fecha como si fuera la del cobro le metía
 * medio millón de pesos a un solo día del panel.
 *
 * El marcador es el discriminante bueno —dice de dónde salió el dato, no qué
 * tan vieja es— y por eso se prefiere a un umbral de días: hay rentas del Excel
 * capturadas apenas 18 días después de terminar, indistinguibles por antigüedad
 * de una captura tardía legítima.
 */
const MARCADOR_MIGRACION = "⟦mig⟧";

/**
 * Mismo criterio que `autorizadoCron`: el endpoint se llama sin sesión, así que
 * se autentica con un secreto compartido; sin la variable queda CERRADO, no
 * abierto.
 */
export function autorizadoIntegracion(req: Request): boolean {
  const secreto = process.env.PASTA_STATS_SECRET;
  if (!secreto) return false;
  return req.headers.get("authorization") === `Bearer ${secreto}`;
}

/** El día en que entró el dinero, en la zona del negocio (no la del server). */
function diaNegocio(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ_NEGOCIO }).format(fecha);
}

/**
 * El día en que entró el dinero. Para lo que se captura en la app es la fecha
 * del pago; para lo que vino del Excel esa fecha no significa nada (ver
 * MARCADOR_MIGRACION) y la mejor disponible es la recolección, que es cuando se
 * liquida la renta.
 */
function fechaDelCobro(pago: PagoConRenta): { fecha: string; estimada: boolean } {
  return pago.renta.notas?.startsWith(MARCADOR_MIGRACION)
    ? { fecha: inputDesdeFecha(pago.renta.fechaFin), estimada: true }
    : { fecha: diaNegocio(pago.fecha), estimada: false };
}

/** Lo que se pagó, en una línea legible del otro lado. */
function conceptoDePago(pago: PagoConRenta): string {
  const equipos = equiposPorModelo(pago.renta.unidades)
    .map((e) => (e.cantidad > 1 ? `${e.cantidad} ${e.nombre}` : e.nombre))
    .join(", ");
  const prefijo =
    pago.tipo === "ANTICIPO" ? "Anticipo" : pago.tipo === "REEMBOLSO" ? "Reembolso" : "Renta";
  const cuando = fechaCorta(pago.renta.fechaInicio);
  return equipos ? `${prefijo} ${cuando} · ${equipos}` : `${prefijo} ${cuando}`;
}

const incluirRenta = {
  renta: {
    select: {
      id: true,
      fechaInicio: true,
      fechaFin: true,
      notas: true,
      cliente: { select: { nombre: true } },
      unidades: { select: { unidad: { select: { modelo: { select: { nombre: true } } } } } },
    },
  },
} as const;

type PagoConRenta = {
  id: string;
  monto: number;
  metodo: PagoExterno["metodo"];
  tipo: PagoExterno["tipo"];
  fecha: Date;
  renta: {
    id: string;
    fechaInicio: Date;
    fechaFin: Date;
    notas: string | null;
    cliente: { nombre: string } | null;
    unidades: { unidad: { modelo: { nombre: string } } }[];
  };
};

export function serializarPago(pago: PagoConRenta): PagoExterno {
  const { fecha, estimada } = fechaDelCobro(pago);
  return {
    id: pago.id,
    fecha,
    fecha_estimada: estimada,
    // El signo lo decide el tipo: un reembolso es dinero que sale.
    monto: pago.tipo === "REEMBOLSO" ? -Math.abs(pago.monto) : pago.monto,
    metodo: pago.metodo,
    tipo: pago.tipo,
    renta_id: pago.renta.id,
    cliente: pago.renta.cliente?.nombre ?? null,
    concepto: conceptoDePago(pago),
  };
}

/**
 * Pagos confirmados de un rango, para el barrido de pasta stats.
 *
 * El rango se aplica sobre la fecha del COBRO, que no siempre es
 * `Pago.fecha` (ver `fechaDelCobro`). Como esa fecha es calculada, la consulta
 * pesca por cualquiera de las dos y el rango final se afina en memoria.
 */
export async function pagosParaExportar(rango: {
  desde: string; // YYYY-MM-DD, inclusivo
  hasta: string; // YYYY-MM-DD, inclusivo
}): Promise<PagoExterno[]> {
  // Hermosillo es UTC−7 fijo: el día local arranca a las 07:00Z. Con un corte
  // en 00:00Z se perderían los cobros de la tarde, que es cuando se entrega.
  const enRango = {
    gte: new Date(`${rango.desde}T07:00:00.000Z`),
    lt: new Date(`${sumarDiasInput(rango.hasta, 1)}T07:00:00.000Z`),
  };
  const pagos = await prisma.pago.findMany({
    where: {
      pagado: true,
      OR: [{ fecha: enRango }, { renta: { fechaFin: enRango } }],
    },
    select: { id: true, monto: true, metodo: true, tipo: true, fecha: true, ...incluirRenta },
    orderBy: { fecha: "asc" },
    take: 2000,
  });

  // El rango de verdad se aplica sobre la fecha del cobro, que es calculada.
  return pagos
    .map(serializarPago)
    .filter((p) => p.fecha >= rango.desde && p.fecha <= rango.hasta);
}

/** Un pago suelto, ya serializado (lo usa el webhook al registrarlo). */
export async function pagoParaExportar(pagoId: string): Promise<PagoExterno | null> {
  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    select: { id: true, monto: true, metodo: true, tipo: true, fecha: true, ...incluirRenta },
  });
  return pago ? serializarPago(pago) : null;
}

type Evento =
  | { evento: "pago.registrado"; pago: PagoExterno }
  | { evento: "pago.eliminado"; pago_id: string };

/**
 * Avisa a pasta stats. NUNCA propaga el error: que el panel esté caído no puede
 * impedir registrar un cobro. Lo que se pierda aquí lo recupera el barrido
 * diario de allá, que relee la ventana completa y es idempotente.
 */
export async function notificarPastaStats(evento: Evento): Promise<void> {
  const base = process.env.PASTA_STATS_URL;
  const secreto = process.env.PASTA_STATS_SECRET;
  if (!base || !secreto) return; // integración apagada

  try {
    const res = await fetch(new URL("/api/ingesta/climaxpress", base), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secreto}`,
      },
      body: JSON.stringify(evento),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.error("[pasta-stats] webhook:", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("[pasta-stats] webhook:", e);
  }
}
