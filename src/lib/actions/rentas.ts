"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoRenta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaDesdeInput, diasDeRenta } from "@/lib/fechas";
import { calcularRenta, type UnidadCalc } from "@/lib/renta-calculo";
import { unidadesDisponibles, unidadesNoDisponibles } from "@/lib/disponibilidad";
import { sugerirCostoDomicilio, type SugerenciaDomicilio } from "@/lib/domicilio";
import { TRANSICIONES } from "@/lib/rentas";
import {
  parseCoordenadas,
  esLinkCortoMaps,
  esUrl,
  type Coordenadas,
} from "@/lib/coordenadas";
import { geocodificarDireccion, distanciaKmDesde, mapsHabilitado } from "@/lib/google-maps";
import { obtenerBodega } from "@/lib/configuracion";

// Sugerencia de costo de domicilio por km (para el formulario de renta).
export async function sugerirDomicilio(km: number): Promise<SugerenciaDomicilio | null> {
  return sugerirCostoDomicilio(km);
}

// Resuelve una ubicación pegada (coords, DMS o link de Maps). Expande links
// cortos (maps.app.goo.gl) siguiendo el redirect en el server. Sin API key.
export type ResultadoUbicacion = {
  coords: Coordenadas | null;
  linkMaps: string | null;
  error?: string;
};

export async function resolverUbicacion(texto: string): Promise<ResultadoUbicacion> {
  const entrada = texto?.trim();
  if (!entrada) return { coords: null, linkMaps: null };

  const linkMaps = esUrl(entrada) ? entrada : null;

  // Intento directo (coords, DMS, o URL con coords embebidas).
  const directo = parseCoordenadas(entrada);
  if (directo) return { coords: directo, linkMaps };

  // Link corto: expandir siguiendo el redirect y parsear la URL final.
  if (esLinkCortoMaps(entrada)) {
    try {
      const res = await fetch(entrada, { redirect: "follow" });
      const expandida = res.url || "";
      const coords = parseCoordenadas(expandida);
      return { coords, linkMaps: expandida || linkMaps };
    } catch {
      return { coords: null, linkMaps, error: "No se pudo expandir el link." };
    }
  }

  return { coords: null, linkMaps };
}

// Flujo completo de ubicación + domicilio (Fase 4):
// 1) coords pegadas (link/DMS/decimales) o, si no hay, geocoding de la dirección
// 2) Distance Matrix desde la bodega → km reales manejando
// 3) km → tarifa sugerida (el admin siempre puede sobrescribir)
export type UbicacionCompleta = {
  coords: Coordenadas | null;
  linkMaps: string | null;
  direccionFormateada: string | null;
  km: number | null;
  minutos: number | null;
  sugerencia: SugerenciaDomicilio | null;
  avisos: string[];
};

export async function ubicarCompleto(entrada: {
  ubicacion: string;
  direccion: string;
}): Promise<UbicacionCompleta> {
  const avisos: string[] = [];
  let coords: Coordenadas | null = null;
  let linkMaps: string | null = null;
  let direccionFormateada: string | null = null;

  const ubicacion = entrada.ubicacion?.trim() ?? "";
  const direccion = entrada.direccion?.trim() ?? "";

  if (ubicacion) {
    const r = await resolverUbicacion(ubicacion);
    coords = r.coords;
    linkMaps = r.linkMaps;
    if (r.error) avisos.push(r.error);
  }

  // Sin coords aún: geocodificar la dirección de texto.
  if (!coords && direccion) {
    if (!mapsHabilitado()) {
      avisos.push("Falta GOOGLE_MAPS_API_KEY para buscar direcciones de texto.");
    } else {
      const g = await geocodificarDireccion(direccion);
      if (g.ok) {
        coords = g.coords;
        direccionFormateada = g.direccionFormateada;
      } else {
        avisos.push(g.error);
      }
    }
  }

  if (!coords && !ubicacion && !direccion) {
    avisos.push("Escribe la dirección o pega un link/coordenadas primero.");
  }

  let km: number | null = null;
  let minutos: number | null = null;
  let sugerencia: SugerenciaDomicilio | null = null;

  if (coords) {
    const bodega = await obtenerBodega();
    if (!bodega) {
      avisos.push("Captura la bodega en Configuración para calcular la distancia.");
    } else if (!mapsHabilitado()) {
      avisos.push("Falta GOOGLE_MAPS_API_KEY para calcular la distancia.");
    } else {
      const d = await distanciaKmDesde(bodega.coords, coords);
      if (d.ok) {
        km = Math.round(d.km * 10) / 10;
        minutos = d.minutos;
        sugerencia = await sugerirCostoDomicilio(km);
      } else {
        avisos.push(d.error);
      }
    }
  }

  return { coords, linkMaps, direccionFormateada, km, minutos, sugerencia, avisos };
}

// ---------- Disponibilidad para el formulario ----------
export type UnidadOpcion = {
  id: string;
  codigo: string;
  modeloId: string;
  modeloNombre: string;
  tipo: "AEROCOOLER" | "CALENTON";
  precioDia: number;
  precioDia3Mas: number | null;
};

export async function unidadesParaFechas(
  inicioStr: string,
  finStr: string,
  excluirRentaId?: string,
): Promise<UnidadOpcion[]> {
  const inicio = fechaDesdeInput(inicioStr);
  const fin = fechaDesdeInput(finStr);
  if (fin < inicio) return [];
  const unidades = await unidadesDisponibles(inicio, fin, excluirRentaId);
  return unidades.map((u) => ({
    id: u.id,
    codigo: u.codigo,
    modeloId: u.modeloId,
    modeloNombre: u.modelo.nombre,
    tipo: u.modelo.tipo,
    precioDia: u.modelo.precioDia,
    precioDia3Mas: u.modelo.precioDia3Mas,
  }));
}

// ---------- Crear renta ----------
const crearSchema = z.object({
  clienteId: z.string().min(1, "Selecciona un cliente"),
  estado: z.enum(["COTIZADA", "CONFIRMADA"]).default("CONFIRMADA"),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de inicio inválida"),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de fin inválida"),
  ventanaEntrega: z.string().trim().optional().nullable(),
  direccion: z.string().trim().min(1, "La dirección es obligatoria"),
  codigoAcceso: z.string().trim().optional().nullable(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  linkMaps: z.string().trim().optional().nullable(),
  distanciaKm: z.number().nonnegative().nullable().optional(),
  costoDomicilio: z.number().int().nonnegative().default(0),
  domicilioSobrescrito: z.boolean().default(false),
  unidadIds: z.array(z.string().min(1)).min(1, "Selecciona al menos una unidad"),
  accesorios: z
    .array(z.object({ accesorioId: z.string().min(1), cargo: z.number().int().nonnegative() }))
    .default([]),
  descuentoMonto: z.number().int().nonnegative().default(0),
  descuentoNota: z.string().trim().optional().nullable(),
  requiereFactura: z.boolean().default(false),
  anticipo: z
    .object({
      monto: z.number().int().positive(),
      metodo: z.enum(["EFECTIVO", "TRANSFERENCIA", "LINK_MERCADO_PAGO", "OTRO"]),
    })
    .nullable()
    .optional(),
  notas: z.string().trim().optional().nullable(),
});

export type CrearRentaInput = z.input<typeof crearSchema>;
export type RentaActionResult = { error: string } | { ok: true; id: string };

export async function crearRenta(
  input: CrearRentaInput,
): Promise<RentaActionResult> {
  const parsed = crearSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  const inicio = fechaDesdeInput(d.fechaInicio);
  const fin = fechaDesdeInput(d.fechaFin);
  if (fin < inicio) return { error: "La fecha de recolección no puede ser antes de la entrega." };
  if (d.descuentoMonto > 0 && !d.descuentoNota) {
    return { error: "Todo descuento requiere una nota con el motivo." };
  }

  try {
    const rentaId = await prisma.$transaction(async (tx) => {
      // Revalidar disponibilidad dentro de la transacción (evita doble apartado).
      const ocupadas = await unidadesNoDisponibles(d.unidadIds, inicio, fin, undefined, tx);
      if (ocupadas.length > 0) {
        throw new Error(`Ya no están disponibles: ${ocupadas.join(", ")}. Actualiza la selección.`);
      }

      // Traer modelos para calcular el precio efectivo (regla calentones 3+).
      const unidades = await tx.unidad.findMany({
        where: { id: { in: d.unidadIds } },
        include: { modelo: true },
      });
      const unidadesCalc: (UnidadCalc & { unidadId: string })[] = unidades.map((u) => ({
        id: u.id,
        unidadId: u.id,
        tipo: u.modelo.tipo,
        precioDia: u.modelo.precioDia,
        precioDia3Mas: u.modelo.precioDia3Mas,
      }));

      const cargosAccesorios = d.accesorios.reduce((acc, a) => acc + a.cargo, 0);
      const calc = calcularRenta({
        unidades: unidadesCalc,
        dias: diasDeRenta(inicio, fin),
        costoDomicilio: d.costoDomicilio,
        cargosAccesorios,
        descuentoMonto: d.descuentoMonto,
      });
      const precioPorUnidad = new Map(calc.unidades.map((u) => [u.id, u.precioEfectivo]));

      const renta = await tx.renta.create({
        data: {
          clienteId: d.clienteId,
          estado: d.estado as EstadoRenta,
          fechaInicio: inicio,
          fechaFin: fin,
          ventanaEntrega: d.ventanaEntrega || null,
          direccion: d.direccion,
          codigoAcceso: d.codigoAcceso || null,
          lat: d.lat ?? null,
          lng: d.lng ?? null,
          linkMaps: d.linkMaps || null,
          distanciaKm: d.distanciaKm ?? null,
          costoDomicilio: d.costoDomicilio,
          domicilioSobrescrito: d.domicilioSobrescrito,
          descuentoMonto: d.descuentoMonto,
          descuentoNota: d.descuentoNota || null,
          requiereFactura: d.requiereFactura,
          notas: d.notas || null,
          unidades: {
            create: unidades.map((u) => ({
              unidadId: u.id,
              precioDia: precioPorUnidad.get(u.id) ?? u.modelo.precioDia,
            })),
          },
          accesorios: {
            create: d.accesorios.map((a) => ({
              accesorioId: a.accesorioId,
              cargo: a.cargo,
            })),
          },
          pagos: d.anticipo
            ? {
                create: {
                  monto: d.anticipo.monto,
                  metodo: d.anticipo.metodo,
                  tipo: "ANTICIPO",
                  pagado: true,
                },
              }
            : undefined,
        },
      });
      return renta.id;
    });

    revalidatePath("/rentas");
    revalidatePath("/clientes");
    return { ok: true, id: rentaId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear la renta." };
  }
}

// ---------- Flujo de estados ----------
export async function cambiarEstadoRenta(
  rentaId: string,
  nuevoEstado: EstadoRenta,
): Promise<RentaActionResult> {
  try {
    await prisma.$transaction(async (tx) => {
      const renta = await tx.renta.findUnique({
        where: { id: rentaId },
        include: { unidades: true },
      });
      if (!renta) throw new Error("Renta no encontrada.");

      const permitidas = TRANSICIONES[renta.estado];
      if (!permitidas.includes(nuevoEstado)) {
        throw new Error(`No se puede pasar de ${renta.estado} a ${nuevoEstado}.`);
      }

      const unidadIds = renta.unidades.map((u) => u.unidadId);

      // Efectos sobre el inventario:
      // ENTREGADA → unidades RENTADA; RECOGIDA/CANCELADA → DISPONIBLE.
      if (nuevoEstado === "ENTREGADA" && unidadIds.length) {
        await tx.unidad.updateMany({
          where: { id: { in: unidadIds } },
          data: { estado: "RENTADA" },
        });
      }
      if ((nuevoEstado === "RECOGIDA" || nuevoEstado === "CANCELADA") && unidadIds.length) {
        await tx.unidad.updateMany({
          where: { id: { in: unidadIds } },
          data: { estado: "DISPONIBLE" },
        });
      }

      await tx.renta.update({ where: { id: rentaId }, data: { estado: nuevoEstado } });
    });

    revalidatePath("/rentas");
    revalidatePath(`/rentas/${rentaId}`);
    revalidatePath("/");
    return { ok: true, id: rentaId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cambiar el estado." };
  }
}

// ---------- Pagos ----------
const pagoSchema = z.object({
  monto: z.number().int().positive("El monto debe ser mayor a 0"),
  metodo: z.enum(["EFECTIVO", "TRANSFERENCIA", "LINK_MERCADO_PAGO", "OTRO"]),
  tipo: z.enum(["ANTICIPO", "LIQUIDACION", "REEMBOLSO"]).default("LIQUIDACION"),
});

export async function registrarPago(
  rentaId: string,
  input: z.input<typeof pagoSchema>,
): Promise<RentaActionResult> {
  const parsed = pagoSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const renta = await prisma.renta.findUnique({ where: { id: rentaId }, select: { id: true } });
  if (!renta) return { error: "Renta no encontrada." };

  await prisma.pago.create({
    data: {
      rentaId,
      monto: parsed.data.monto,
      metodo: parsed.data.metodo,
      tipo: parsed.data.tipo,
      pagado: true, // pago manual confirmado
    },
  });

  revalidatePath(`/rentas/${rentaId}`);
  revalidatePath("/rentas");
  return { ok: true, id: rentaId };
}
