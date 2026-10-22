import { prisma } from "@/lib/prisma";
import { ESTADOS_ACTIVOS } from "@/lib/disponibilidad";
import { equiposPorModelo, RECOLECCION_HECHA, type EstadoRentaStr } from "@/lib/rentas";
import { hoyNegocio } from "@/lib/fechas";

// Estados que trae el calendario. La ocupación la marcan solo los ACTIVOS, pero
// la lista del día incluye además las ya recogidas: al marcar "Recogido" la
// renta salía de la cuadrícula y su recolección desaparecía del día como si
// nunca se hubiera programado (no se podía distinguir "no existe" de "ya se
// hizo"). CONCLUIDA se queda fuera a propósito: solo lo traen las 482 rentas
// migradas del Excel y llenaría los meses viejos.
const ESTADOS_CALENDARIO = [...ESTADOS_ACTIVOS, "RECOGIDA"] as const;

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
  hecha: boolean; // el equipo ya se recogió: se lista al final y atenuada
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
 *
 * La lista de rentas de cada día es más amplia que la ocupación: incluye las ya
 * recogidas (ver ESTADOS_CALENDARIO), que no ocupan nada pero sí pasaron ese día.
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
        estado: { in: [...ESTADOS_CALENDARIO] },
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
    // Una renta ya recogida se lista en su día pero no aparta unidad.
    hecha: RECOLECCION_HECHA.includes(r.estado as EstadoRentaStr),
  }));

  const dias: DiaCalendario[] = [];
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = `${mes}-${String(d).padStart(2, "0")}`;
    // Unidades ocupadas ese día, sin duplicar (una unidad = una ocupación).
    const ocupadasPorModelo = new Map<string, Set<string>>();
    const rentasDelDia: RentaDia[] = [];

    for (const o of ocupaciones) {
      // ¿La renta toca el día? (entrega, en curso o recolección) — es lo que
      // decide si se lista, aunque el equipo ya se haya recogido.
      if (fecha < o.inicio || fecha > o.fin) continue;
      // Misma regla fin-exclusiva que disponibilidad.ts, y solo las que siguen
      // apartando equipo: una recogida ya dejó libre su unidad.
      const ocupa = !o.hecha && (fecha < o.fin || fecha === o.inicio);
      const recoleccion = o.fin === fecha;

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
        hecha: o.hecha,
      });
    }

    const libresPorModelo: Record<string, number> = {};
    for (const m of modelos) {
      const ocupadas = ocupadasPorModelo.get(m.id)?.size ?? 0;
      libresPorModelo[m.id] = Math.max(0, m.total - ocupadas);
    }

    // Pendientes primero (como el dashboard); dentro de cada grupo, entregas,
    // luego recolecciones y al final las que solo siguen en curso.
    rentasDelDia.sort(
      (a, b) =>
        Number(a.hecha) - Number(b.hecha) ||
        Number(b.entrega) - Number(a.entrega) ||
        Number(b.recoleccion) - Number(a.recoleccion)
    );

    dias.push({ fecha, dia: d, libresPorModelo, rentas: rentasDelDia });
  }

  return { mes, modelos, dias };
}
