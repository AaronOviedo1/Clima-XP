import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  rentaInclude,
  totalesDeRenta,
  type RentaCompleta,
  type EstadoRentaStr,
} from "@/lib/rentas";
import { fechaDesdeInput, hoyNegocio, sumarDiasInput } from "@/lib/fechas";

// DTO serializable para las tarjetas del dashboard (client components).
export type TarjetaRenta = {
  id: string;
  estado: EstadoRentaStr;
  clienteNombre: string;
  telefono: string | null;
  direccion: string;
  lat: number | null;
  lng: number | null;
  ventanaEntrega: string | null;
  codigos: string[];
  total: number;
  saldo: number;
};

export function tarjetaDesdeRenta(renta: RentaCompleta): TarjetaRenta {
  const t = totalesDeRenta(renta);
  return {
    id: renta.id,
    estado: renta.estado as EstadoRentaStr,
    clienteNombre: renta.cliente.nombre,
    telefono: renta.cliente.telefono,
    direccion: renta.direccion,
    lat: renta.lat,
    lng: renta.lng,
    ventanaEntrega: renta.ventanaEntrega,
    codigos: renta.unidades.map((u) => u.unidad.codigo),
    total: t.total,
    saldo: t.saldo,
  };
}

export type RentaConSaldo = { renta: RentaCompleta; saldo: number; total: number };

export type DatosDelDia = {
  hoy: Date;
  entregas: RentaCompleta[]; // se entregan hoy (por confirmar/en ruta)
  recolecciones: RentaCompleta[]; // se recogen hoy (entregadas)
  manana: RentaCompleta[]; // entregas de mañana
  saldos: RentaConSaldo[]; // solo admin
};

export async function datosDelDia(opts: {
  esAdmin: boolean;
  repartidorId?: string;
}): Promise<DatosDelDia> {
  const hoyStr = hoyNegocio();
  const mananaStr = sumarDiasInput(hoyStr, 1);
  const hoy = fechaDesdeInput(hoyStr);
  const manana = fechaDesdeInput(mananaStr);

  // El repartidor solo ve lo asignado a él.
  const filtroRepartidor: Prisma.RentaWhereInput =
    !opts.esAdmin && opts.repartidorId ? { repartidorId: opts.repartidorId } : {};

  const [entregas, recolecciones, mananaRentas] = await Promise.all([
    prisma.renta.findMany({
      where: {
        ...filtroRepartidor,
        fechaInicio: { equals: hoy },
        estado: { in: ["CONFIRMADA", "EN_RUTA"] },
      },
      include: rentaInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.renta.findMany({
      where: {
        ...filtroRepartidor,
        fechaFin: { equals: hoy },
        estado: { equals: "ENTREGADA" },
      },
      include: rentaInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.renta.findMany({
      where: {
        ...filtroRepartidor,
        fechaInicio: { equals: manana },
        estado: { in: ["COTIZADA", "CONFIRMADA"] },
      },
      include: rentaInclude,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Saldos pendientes (solo admin): rentas activas con saldo > 0.
  // Se excluyen CONCLUIDA (ya pagadas/cerradas), CANCELADA y COTIZADA.
  let saldos: RentaConSaldo[] = [];
  if (opts.esAdmin) {
    const candidatas = await prisma.renta.findMany({
      where: { estado: { in: ["CONFIRMADA", "EN_RUTA", "ENTREGADA", "RECOGIDA"] } },
      include: rentaInclude,
      orderBy: { fechaInicio: "asc" },
      take: 300,
    });
    saldos = candidatas
      .map((renta) => {
        const t = totalesDeRenta(renta);
        return { renta, saldo: t.saldo, total: t.total };
      })
      .filter((x) => x.saldo > 0);
  }

  return { hoy, entregas, recolecciones, manana: mananaRentas, saldos };
}
