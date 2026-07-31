import "server-only";
import { prisma } from "@/lib/prisma";
import { calcularRenta, type UnidadCalc } from "@/lib/renta-calculo";
import { diasDeRenta, fechaCorta } from "@/lib/fechas";

// Datos de la hoja de cotización que se le manda al cliente (ver
// /api/cotizacion, que los pinta como imagen). Se arman desde dos orígenes —
// una renta COTIZADA guardada o una selección suelta del formulario — pero el
// resultado es el mismo, así que la hoja tiene un solo diseño que mantener.
//
// Los precios NUNCA vienen del cliente: se leen de la BD por unidadId y se
// pasan por calcularRenta, que es quien aplica la regla de 3+ calentones.

export type LineaCotizacion = {
  cantidad: number;
  modelo: string;
  precioDia: number; // precio efectivo por equipo por día
  subtotal: number; // cantidad × precioDia × días
};

export type HojaCotizacion = {
  cliente: string | null;
  periodo: string; // "10 – 12 ago 2026"
  dias: number;
  lineas: LineaCotizacion[];
  subtotalEquipos: number;
  costoDomicilio: number;
  distanciaKm: number | null;
  descuentoMonto: number;
  descuentoNota: string | null;
  total: number;
};

type UnidadConModelo = {
  id: string;
  modelo: { nombre: string; tipo: string; precioDia: number; precioDia3Mas: number | null };
};

// Agrupa las unidades ya calculadas en renglones por modelo. Dos unidades del
// mismo modelo comparten precio efectivo, así que caen en el mismo renglón.
function lineasPorModelo(
  unidades: UnidadConModelo[],
  precios: Map<string, number>,
  dias: number,
): LineaCotizacion[] {
  const porModelo = new Map<string, LineaCotizacion>();
  for (const u of unidades) {
    const precioDia = precios.get(u.id) ?? u.modelo.precioDia;
    const linea = porModelo.get(u.modelo.nombre);
    if (linea) {
      linea.cantidad += 1;
      linea.subtotal += precioDia * dias;
    } else {
      porModelo.set(u.modelo.nombre, {
        cantidad: 1,
        modelo: u.modelo.nombre,
        precioDia,
        subtotal: precioDia * dias,
      });
    }
  }
  return [...porModelo.values()].sort((a, b) => b.cantidad - a.cantidad);
}

function periodoTexto(inicio: Date, fin: Date): string {
  const desde = fechaCorta(inicio);
  const hasta = fechaCorta(fin);
  // Renta de un día: repetir la misma fecha dos veces se lee raro.
  return desde === hasta ? desde : `${desde} – ${hasta}`;
}

function paraCalculo(u: UnidadConModelo): UnidadCalc {
  return {
    id: u.id,
    tipo: u.modelo.tipo === "CALENTON" ? "CALENTON" : "AEROCOOLER",
    precioDia: u.modelo.precioDia,
    precioDia3Mas: u.modelo.precioDia3Mas,
  };
}

const selectUnidad = {
  id: true,
  modelo: { select: { nombre: true, tipo: true, precioDia: true, precioDia3Mas: true } },
} as const;

// Cotización guardada: se cobra lo que dice la renta (snapshots de RentaUnidad),
// no los precios de hoy — así la hoja coincide con lo que se le prometió.
export async function datosDesdeRenta(rentaId: string): Promise<HojaCotizacion | null> {
  const renta = await prisma.renta.findUnique({
    where: { id: rentaId },
    select: {
      fechaInicio: true,
      fechaFin: true,
      costoDomicilio: true,
      distanciaKm: true,
      descuentoMonto: true,
      descuentoNota: true,
      cliente: { select: { nombre: true } },
      unidades: { select: { precioDia: true, unidad: { select: selectUnidad } } },
    },
  });
  if (!renta) return null;

  const dias = diasDeRenta(renta.fechaInicio, renta.fechaFin);
  const precios = new Map(renta.unidades.map((ru) => [ru.unidad.id, ru.precioDia]));
  const lineas = lineasPorModelo(
    renta.unidades.map((ru) => ru.unidad),
    precios,
    dias,
  );
  const subtotalEquipos = lineas.reduce((acc, l) => acc + l.subtotal, 0);

  return {
    cliente: renta.cliente.nombre,
    periodo: periodoTexto(renta.fechaInicio, renta.fechaFin),
    dias,
    lineas,
    subtotalEquipos,
    costoDomicilio: renta.costoDomicilio,
    distanciaKm: renta.distanciaKm,
    descuentoMonto: renta.descuentoMonto,
    descuentoNota: renta.descuentoNota,
    total: Math.max(0, subtotalEquipos + renta.costoDomicilio - renta.descuentoMonto),
  };
}

export type SeleccionCotizacion = {
  unidadIds: string[];
  fechaInicio: Date;
  fechaFin: Date;
  costoDomicilio: number;
  distanciaKm: number | null;
  descuentoMonto: number;
  cliente: string | null;
};

// Cotización que no se guardó: los precios salen del catálogo vigente.
export async function datosDesdeSeleccion(
  sel: SeleccionCotizacion,
): Promise<HojaCotizacion | null> {
  if (sel.unidadIds.length === 0) return null;

  const unidades = await prisma.unidad.findMany({
    where: { id: { in: sel.unidadIds } },
    select: selectUnidad,
  });
  if (unidades.length === 0) return null;

  const dias = diasDeRenta(sel.fechaInicio, sel.fechaFin);
  const calc = calcularRenta({
    unidades: unidades.map(paraCalculo),
    dias,
    costoDomicilio: sel.costoDomicilio,
    cargosAccesorios: 0,
    descuentoMonto: sel.descuentoMonto,
  });
  const precios = new Map(calc.unidades.map((u) => [u.id, u.precioEfectivo]));
  const lineas = lineasPorModelo(unidades, precios, dias);

  return {
    cliente: sel.cliente,
    periodo: periodoTexto(sel.fechaInicio, sel.fechaFin),
    dias,
    lineas,
    subtotalEquipos: calc.subtotalEquipos,
    costoDomicilio: calc.costoDomicilio,
    distanciaKm: sel.distanciaKm,
    descuentoMonto: calc.descuentoMonto,
    descuentoNota: null,
    total: calc.total,
  };
}
