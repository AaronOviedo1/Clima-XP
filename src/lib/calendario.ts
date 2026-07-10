import { prisma } from "@/lib/prisma";
import { ESTADOS_ACTIVOS } from "@/lib/disponibilidad";
import { hoyNegocio } from "@/lib/fechas";

export type ModeloCalendario = {
  id: string;
  nombre: string;
  tipo: "AEROCOOLER" | "CALENTON";
  total: number; // unidades activas (sin MANTENIMIENTO/BAJA)
};

export type DiaCalendario = {
  fecha: string; // "yyyy-mm-dd"
  dia: number; // día del mes (1..31)
  libresPorModelo: Record<string, number>; // modeloId -> unidades libres
};

export type DatosCalendario = {
  mes: string; // "yyyy-mm"
  modelos: ModeloCalendario[];
  dias: DiaCalendario[];
};

// Valida "yyyy-mm"; si no es válido devuelve el mes actual del negocio.
export function mesValido(mes?: string): string {
  if (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return mes;
  return hoyNegocio().slice(0, 7);
}

// Suma meses a un "yyyy-mm".
export function sumarMeses(mes: string, delta: number): string {
  const [anio, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(anio, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * Ocupación por modelo por día del mes. Un día cuenta como ocupado para una
 * unidad si cae dentro de [fechaInicio, fechaFin] de una renta activa
 * (CONFIRMADA/EN_RUTA/ENTREGADA) — misma regla de traslape que disponibilidad.ts.
 */
export async function datosCalendario(mes: string): Promise<DatosCalendario> {
  const [anio, mesNum] = mes.split("-").map(Number);
  const diasEnMes = new Date(Date.UTC(anio, mesNum, 0)).getUTCDate();
  const inicioMes = new Date(`${mes}-01T00:00:00.000Z`);
  const finMes = new Date(Date.UTC(anio, mesNum - 1, diasEnMes, 23, 59, 59));

  const [modelosDb, rentas] = await Promise.all([
    prisma.modeloEquipo.findMany({
      include: {
        unidades: {
          where: { estado: { notIn: ["MANTENIMIENTO", "BAJA"] } },
          select: { id: true },
        },
      },
      orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
    }),
    prisma.renta.findMany({
      where: {
        estado: { in: [...ESTADOS_ACTIVOS] },
        fechaInicio: { lte: finMes },
        fechaFin: { gte: inicioMes },
      },
      select: {
        fechaInicio: true,
        fechaFin: true,
        unidades: { select: { unidad: { select: { id: true, modeloId: true } } } },
      },
    }),
  ]);

  // Solo modelos con unidades activas (p. ej. Chispas-Frescas tiene 0).
  const modelos: ModeloCalendario[] = modelosDb
    .filter((m) => m.unidades.length > 0)
    .map((m) => ({ id: m.id, nombre: m.nombre, tipo: m.tipo, total: m.unidades.length }));

  // Rentas normalizadas a fecha "pura" para comparar por día sin zona horaria.
  const ocupaciones = rentas.map((r) => ({
    inicio: r.fechaInicio.toISOString().slice(0, 10),
    fin: r.fechaFin.toISOString().slice(0, 10),
    unidades: r.unidades.map((u) => u.unidad),
  }));

  const dias: DiaCalendario[] = [];
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = `${mes}-${String(d).padStart(2, "0")}`;
    // Unidades ocupadas ese día, sin duplicar (una unidad = una ocupación).
    const ocupadasPorModelo = new Map<string, Set<string>>();
    for (const o of ocupaciones) {
      if (o.inicio <= fecha && fecha <= o.fin) {
        for (const u of o.unidades) {
          if (!ocupadasPorModelo.has(u.modeloId)) ocupadasPorModelo.set(u.modeloId, new Set());
          ocupadasPorModelo.get(u.modeloId)!.add(u.id);
        }
      }
    }
    const libresPorModelo: Record<string, number> = {};
    for (const m of modelos) {
      const ocupadas = ocupadasPorModelo.get(m.id)?.size ?? 0;
      libresPorModelo[m.id] = Math.max(0, m.total - ocupadas);
    }
    dias.push({ fecha, dia: d, libresPorModelo });
  }

  return { mes, modelos, dias };
}
