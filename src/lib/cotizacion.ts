import "server-only";
import { prisma } from "@/lib/prisma";
import { diasDeRenta, fechaConMes } from "@/lib/fechas";

// Datos de la hoja de cotización que se le manda al cliente (ver
// /api/cotizacion, que los pinta como imagen). Sale de cualquier renta, esté
// cotizada o confirmada.
//
// Los importes son los snapshots guardados en RentaUnidad, no los precios de
// hoy: la hoja tiene que decir lo mismo que se le prometió al cliente aunque el
// catálogo haya cambiado después.

export const TASA_IVA = 0.16;

export type LineaCotizacion = {
  cantidad: number;
  modelo: string;
  precioDia: number; // precio efectivo por equipo por día
  importe: number; // cantidad × precioDia × días
};

// Un grupo por tipo de equipo: el encabezado de la tabla dice AEROCOOLER o
// CALENTON, y una renta mixta saca las dos tablas.
export type GrupoCotizacion = {
  titulo: string;
  lineas: LineaCotizacion[];
};

export type HojaCotizacion = {
  fecha: string; // fecha de entrega, "29 JUNIO 2025"
  dias: number;
  grupos: GrupoCotizacion[];
  subtotalEquipos: number;
  costoDomicilio: number;
  descuentoMonto: number;
  descuentoPct: string | null; // "20%" / "35.8%"
  subtotalConDescuento: number;
  iva: number | null; // null cuando la renta no pide factura
  total: number;
};

type UnidadConModelo = {
  id: string;
  modelo: { nombre: string; tipo: string };
};

const TITULO_TIPO: Record<string, string> = {
  AEROCOOLER: "AEROCOOLER",
  CALENTON: "CALENTÓN",
};

// Agrupa las unidades en renglones por modelo, y los modelos por tipo de
// equipo. Dos unidades del mismo modelo comparten precio, así que caen en el
// mismo renglón.
function gruposPorTipo(
  unidades: UnidadConModelo[],
  precios: Map<string, number>,
  dias: number,
): GrupoCotizacion[] {
  const porTipo = new Map<string, Map<string, LineaCotizacion>>();

  for (const u of unidades) {
    const precioDia = precios.get(u.id) ?? 0;
    const tipo = u.modelo.tipo;
    const lineas = porTipo.get(tipo) ?? new Map<string, LineaCotizacion>();
    const linea = lineas.get(u.modelo.nombre);
    if (linea) {
      linea.cantidad += 1;
      linea.importe += precioDia * dias;
    } else {
      lineas.set(u.modelo.nombre, {
        cantidad: 1,
        modelo: u.modelo.nombre,
        precioDia,
        importe: precioDia * dias,
      });
    }
    porTipo.set(tipo, lineas);
  }

  return [...porTipo.entries()].map(([tipo, lineas]) => ({
    titulo: TITULO_TIPO[tipo] ?? "EQUIPO",
    lineas: [...lineas.values()].sort((a, b) => b.cantidad - a.cantidad),
  }));
}

// El descuento se guarda como monto, pero en la hoja va también en porcentaje
// (así se cotiza en el negocio: "20% renta larga"). Con un decimal solo cuando
// no sale redondo, para no escribir "36%" de algo que fue 35.8%.
function porcentajeDescuento(descuento: number, base: number): string | null {
  if (descuento <= 0 || base <= 0) return null;
  const pct = (descuento / base) * 100;
  const redondo = Math.abs(pct - Math.round(pct)) < 0.05;
  return `${redondo ? Math.round(pct) : pct.toFixed(1)}%`;
}

export async function datosDesdeRenta(rentaId: string): Promise<HojaCotizacion | null> {
  const renta = await prisma.renta.findUnique({
    where: { id: rentaId },
    select: {
      fechaInicio: true,
      fechaFin: true,
      costoDomicilio: true,
      descuentoMonto: true,
      requiereFactura: true,
      unidades: {
        select: {
          precioDia: true,
          unidad: { select: { id: true, modelo: { select: { nombre: true, tipo: true } } } },
        },
      },
    },
  });
  if (!renta) return null;

  const dias = diasDeRenta(renta.fechaInicio, renta.fechaFin);
  const precios = new Map(renta.unidades.map((ru) => [ru.unidad.id, ru.precioDia]));
  const grupos = gruposPorTipo(
    renta.unidades.map((ru) => ru.unidad),
    precios,
    dias,
  );
  const subtotalEquipos = grupos
    .flatMap((g) => g.lineas)
    .reduce((acc, l) => acc + l.importe, 0);

  // Mismo orden que la hoja: equipos + domicilio − descuento, y el IVA sobre
  // eso (solo si la renta pide factura).
  const subtotalConDescuento = Math.max(
    0,
    subtotalEquipos + renta.costoDomicilio - renta.descuentoMonto,
  );
  const iva = renta.requiereFactura ? Math.round(subtotalConDescuento * TASA_IVA) : null;

  return {
    fecha: fechaConMes(renta.fechaInicio).toUpperCase(),
    dias,
    grupos,
    subtotalEquipos,
    costoDomicilio: renta.costoDomicilio,
    descuentoMonto: renta.descuentoMonto,
    // El porcentaje se saca sobre el equipo, que es sobre lo que se descuenta
    // (el domicilio no entra en el "20% renta larga").
    descuentoPct: porcentajeDescuento(renta.descuentoMonto, subtotalEquipos),
    subtotalConDescuento,
    iva,
    total: subtotalConDescuento + (iva ?? 0),
  };
}
