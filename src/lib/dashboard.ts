import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  rentaListSelect,
  rentaTarjetaSelect,
  totalesDeRenta,
  ENTREGA_HECHA,
  RECOLECCION_HECHA,
  type RentaLista,
  type RentaTarjeta,
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

export function tarjetaDesdeRenta(renta: RentaTarjeta): TarjetaRenta {
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

export type RentaConSaldo = { renta: RentaLista; saldo: number; total: number };

export type DatosDelDia = {
  hoy: Date;
  entregas: RentaTarjeta[]; // se entregan hoy (incluye ya entregadas; pendientes primero)
  recolecciones: RentaTarjeta[]; // se recogen hoy (incluye ya recogidas; pendientes primero)
  manana: RentaTarjeta[]; // entregas de mañana
  saldos: RentaConSaldo[]; // solo admin
};

export async function datosDelDia(opts: {
  esAdmin: boolean;
  repartidorId?: string;
  conSaldos?: boolean; // /ruta lo apaga: no usa saldos
  fecha?: string; // "yyyy-mm-dd"; por defecto hoy (usado por /ruta para armar rutas de otros días)
}): Promise<DatosDelDia> {
  const conSaldos = opts.conSaldos ?? opts.esAdmin;
  const hoyStr = opts.fecha ?? hoyNegocio();
  const mananaStr = sumarDiasInput(hoyStr, 1);
  const hoy = fechaDesdeInput(hoyStr);
  const manana = fechaDesdeInput(mananaStr);

  // El repartidor solo ve lo asignado a él.
  const filtroRepartidor: Prisma.RentaWhereInput =
    !opts.esAdmin && opts.repartidorId ? { repartidorId: opts.repartidorId } : {};

  const [entregas, recolecciones, mananaRentas, candidatas] = await Promise.all([
    prisma.renta.findMany({
      relationLoadStrategy: "join",
      where: {
        ...filtroRepartidor,
        fechaInicio: { equals: hoy },
        estado: { in: ["CONFIRMADA", "EN_RUTA", "ENTREGADA", "RECOGIDA", "CONCLUIDA"] },
      },
      select: rentaTarjetaSelect,
      orderBy: { createdAt: "asc" },
    }),
    prisma.renta.findMany({
      relationLoadStrategy: "join",
      where: {
        ...filtroRepartidor,
        fechaFin: { equals: hoy },
        estado: { in: ["ENTREGADA", "RECOGIDA", "CONCLUIDA"] },
      },
      select: rentaTarjetaSelect,
      orderBy: { createdAt: "asc" },
    }),
    prisma.renta.findMany({
      relationLoadStrategy: "join",
      where: {
        ...filtroRepartidor,
        fechaInicio: { equals: manana },
        estado: { in: ["COTIZADA", "CONFIRMADA"] },
      },
      select: rentaTarjetaSelect,
      orderBy: { createdAt: "asc" },
    }),
    // Saldos pendientes (solo admin): rentas activas con saldo > 0.
    // Se excluyen CONCLUIDA (ya pagadas/cerradas), CANCELADA y COTIZADA.
    conSaldos
      ? prisma.renta.findMany({
          relationLoadStrategy: "join",
          where: { estado: { in: ["CONFIRMADA", "EN_RUTA", "ENTREGADA", "RECOGIDA"] } },
          select: rentaListSelect,
          orderBy: { fechaInicio: "asc" },
          take: 300,
        })
      : Promise.resolve([] as RentaLista[]),
  ]);

  // Pendientes primero, lo ya hecho al final (sort estable conserva createdAt).
  entregas.sort(
    (a, b) =>
      Number(ENTREGA_HECHA.includes(a.estado as EstadoRentaStr)) -
      Number(ENTREGA_HECHA.includes(b.estado as EstadoRentaStr))
  );
  recolecciones.sort(
    (a, b) =>
      Number(RECOLECCION_HECHA.includes(a.estado as EstadoRentaStr)) -
      Number(RECOLECCION_HECHA.includes(b.estado as EstadoRentaStr))
  );

  const saldos: RentaConSaldo[] = candidatas
    .map((renta) => {
      const t = totalesDeRenta(renta);
      return { renta, saldo: t.saldo, total: t.total };
    })
    .filter((x) => x.saldo > 0);

  return { hoy, entregas, recolecciones, manana: mananaRentas, saldos };
}
