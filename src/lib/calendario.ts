import { prisma } from "@/lib/prisma";
import { ESTADOS_ACTIVOS } from "@/lib/disponibilidad";
import { equiposPorModelo } from "@/lib/rentas";
import { hoyNegocio } from "@/lib/fechas";

export type ModeloCalendario = {
  id: string;
  nombre: string;
  abrev: string; // "Eco-Fresco" -> "EF"; para que quepa en la celda del día
  tipo: "AEROCOOLER" | "CALENTON";
  total: number; // unidades activas (sin MANTENIMIENTO/BAJA)
};

// Iniciales de cada palabra: "Eco-Fresco" -> "EF", "Fire Sense Café" -> "FSC".
function abreviar(nombre: string): string {
  return nombre
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase())
    .join("")
    .slice(0, 3);
}

// Renta que toca un día, para el pop-up del calendario.
export type RentaDia = {
  id: string;
  cliente: string;
  estado: string;
  equipos: { nombre: string; cantidad: number }[];
  entrega: boolean; // se entrega ese día
  recoleccion: boolean; // se recoge ese día (la unidad ya cuenta como libre)
};

export type DiaCalendario = {
  fecha: string; // "yyyy-mm-dd"
  dia: number; // día del mes (1..31)
  libresPorModelo: Record<string, number>; // modeloId -> unidades libres
  rentas: RentaDia[]; // las que ocupan el día + las que se recogen ese día
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
 * unidad si cae dentro de [fechaInicio, fechaFin) de una renta activa
 * (CONFIRMADA/EN_RUTA/ENTREGADA) — misma regla fin-exclusiva que
 * disponibilidad.ts: el día de recolección la unidad ya está libre.
 * Una renta con entrega y recolección el mismo día ocupa ese único día.
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
      relationLoadStrategy: "join",
      select: {
        id: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        cliente: { select: { nombre: true } },
        unidades: {
          select: {
            unidad: {
              select: {
                id: true,
                modeloId: true,
                modelo: { select: { nombre: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  // Solo modelos con unidades activas (p. ej. Chispas-Frescas tiene 0).
  const modelos: ModeloCalendario[] = modelosDb
    .filter((m) => m.unidades.length > 0)
    .map((m) => ({
      id: m.id,
      nombre: m.nombre,
      abrev: abreviar(m.nombre),
      tipo: m.tipo,
      total: m.unidades.length,
    }));

  // Rentas normalizadas a fecha "pura" para comparar por día sin zona horaria.
  const ocupaciones = rentas.map((r) => ({
    id: r.id,
    estado: r.estado,
    cliente: r.cliente.nombre,
    inicio: r.fechaInicio.toISOString().slice(0, 10),
    fin: r.fechaFin.toISOString().slice(0, 10),
    unidades: r.unidades.map((u) => u.unidad),
    equipos: equiposPorModelo(r.unidades),
  }));

  const dias: DiaCalendario[] = [];
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = `${mes}-${String(d).padStart(2, "0")}`;
    // Unidades ocupadas ese día, sin duplicar (una unidad = una ocupación).
    const ocupadasPorModelo = new Map<string, Set<string>>();
    const rentasDelDia: RentaDia[] = [];

    for (const o of ocupaciones) {
      // Misma regla fin-exclusiva que disponibilidad.ts.
      const ocupa = o.inicio <= fecha && (fecha < o.fin || fecha === o.inicio);
      const recoleccion = o.fin === fecha;
      if (!ocupa && !recoleccion) continue;

      if (ocupa) {
        for (const u of o.unidades) {
          if (!ocupadasPorModelo.has(u.modeloId)) ocupadasPorModelo.set(u.modeloId, new Set());
          ocupadasPorModelo.get(u.modeloId)!.add(u.id);
        }
      }
      // La recolección se muestra aunque ese día la unidad ya no ocupe.
      rentasDelDia.push({
        id: o.id,
        cliente: o.cliente,
        estado: o.estado,
        equipos: o.equipos,
        entrega: o.inicio === fecha,
        recoleccion,
      });
    }

    const libresPorModelo: Record<string, number> = {};
    for (const m of modelos) {
      const ocupadas = ocupadasPorModelo.get(m.id)?.size ?? 0;
      libresPorModelo[m.id] = Math.max(0, m.total - ocupadas);
    }

    // Entregas primero, luego recolecciones, luego las que solo siguen en curso.
    rentasDelDia.sort(
      (a, b) => Number(b.entrega) - Number(a.entrega) || Number(b.recoleccion) - Number(a.recoleccion)
    );

    dias.push({ fecha, dia: d, libresPorModelo, rentas: rentasDelDia });
  }

  return { mes, modelos, dias };
}
