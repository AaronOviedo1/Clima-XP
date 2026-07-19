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
  // Tipos de equipo de la renta (AEROCOOLER/CALENTON): definen qué accesorios
  // ofrecer al marcar la entrega desde la tarjeta.
  tiposEquipo: string[];
  total: number;
  saldo: number;
};

// `conDinero: false` deja los montos en cero: el DTO viaja al cliente, así que
// esconderlos en la UI no basta — al repartidor no le llegan ni en el HTML.
export function tarjetaDesdeRenta(
  renta: RentaTarjeta,
  opts: { conDinero: boolean }
): TarjetaRenta {
  const t = opts.conDinero ? totalesDeRenta(renta) : null;
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
    tiposEquipo: [...new Set(renta.unidades.map((u) => u.unidad.modelo.tipo))],
    total: t?.total ?? 0,
    saldo: t?.saldo ?? 0,
  };
}

export type RentaConSaldo = { renta: RentaLista; saldo: number; total: number };

/**
 * Rentas activas que todavía deben dinero. Solo para admin (el dashboard y el
 * aviso de saldos la comparten). Se excluyen CONCLUIDA (ya cerradas), CANCELADA
 * y COTIZADA (aún no es venta).
 */
export async function saldosPendientes(limite = 300): Promise<RentaConSaldo[]> {
  const candidatas = await prisma.renta.findMany({
    relationLoadStrategy: "join",
    where: { estado: { in: ["CONFIRMADA", "EN_RUTA", "ENTREGADA", "RECOGIDA"] } },
    select: rentaListSelect,
    orderBy: { fechaInicio: "asc" },
    take: limite,
  });

  return candidatas
    .map((renta) => {
      const t = totalesDeRenta(renta);
      return { renta, saldo: t.saldo, total: t.total };
    })
    .filter((x) => x.saldo > 0);
}

export type DatosDelDia = {
  hoy: Date;
  entregas: RentaTarjeta[]; // se entregan hoy (incluye ya entregadas; pendientes primero)
  recolecciones: RentaTarjeta[]; // se recogen hoy (incluye ya recogidas; pendientes primero)
  manana: RentaTarjeta[]; // entregas de mañana
  saldos: RentaConSaldo[]; // solo admin
};

export async function datosDelDia(opts: {
  esAdmin: boolean;
  conSaldos?: boolean; // /ruta lo apaga: no usa saldos
  fecha?: string; // "yyyy-mm-dd"; por defecto hoy (usado por /ruta para armar rutas de otros días)
}): Promise<DatosDelDia> {
  const conSaldos = opts.conSaldos ?? opts.esAdmin;
  const hoyStr = opts.fecha ?? hoyNegocio();
  const mananaStr = sumarDiasInput(hoyStr, 1);
  const hoy = fechaDesdeInput(hoyStr);
  const manana = fechaDesdeInput(mananaStr);

  // Todos ven las mismas rentas del día (no se asignan a un repartidor en
  // particular). Lo que el repartidor no ve es el dinero: eso lo controla
  // `conSaldos` aquí y `conDinero` en tarjetaDesdeRenta.
  const [entregas, recolecciones, mananaRentas, saldos] = await Promise.all([
    prisma.renta.findMany({
      relationLoadStrategy: "join",
      where: {
        fechaInicio: { equals: hoy },
        estado: { in: ["CONFIRMADA", "EN_RUTA", "ENTREGADA", "RECOGIDA", "CONCLUIDA"] },
      },
      select: rentaTarjetaSelect,
      orderBy: { createdAt: "asc" },
    }),
    prisma.renta.findMany({
      relationLoadStrategy: "join",
      where: {
        fechaFin: { equals: hoy },
        estado: { in: ["ENTREGADA", "RECOGIDA", "CONCLUIDA"] },
      },
      select: rentaTarjetaSelect,
      orderBy: { createdAt: "asc" },
    }),
    prisma.renta.findMany({
      relationLoadStrategy: "join",
      where: {
        fechaInicio: { equals: manana },
        estado: { in: ["COTIZADA", "CONFIRMADA"] },
      },
      select: rentaTarjetaSelect,
      orderBy: { createdAt: "asc" },
    }),
    conSaldos ? saldosPendientes() : Promise.resolve([] as RentaConSaldo[]),
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

  return { hoy, entregas, recolecciones, manana: mananaRentas, saldos };
}
