"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoRenta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaDesdeInput, diasDeRenta } from "@/lib/fechas";
import { calcularRenta, type UnidadCalc } from "@/lib/renta-calculo";
import {
  unidadesDisponibles,
  unidadesNoDisponibles,
  ESTADOS_ACTIVOS,
} from "@/lib/disponibilidad";
import { sugerirCostoDomicilio, type SugerenciaDomicilio } from "@/lib/domicilio";
import { esAdmin } from "@/lib/auth-guard";
import { auth } from "@/auth";
import { AUTH_HABILITADA } from "@/lib/auth-flag";
import { avisar } from "@/lib/push";
import { avisarEntregaMarcada, avisarRentaConfirmada } from "@/lib/avisos";
import {
  TRANSICIONES,
  ESTADOS_EDITABLES,
  ESTADOS_CERRADOS,
  UNIDADES_BLOQUEADAS,
} from "@/lib/rentas";
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

      // Los accesorios se capturan hasta la entrega (marcarEntregada), sin costo.
      const calc = calcularRenta({
        unidades: unidadesCalc,
        dias: diasDeRenta(inicio, fin),
        costoDomicilio: d.costoDomicilio,
        cargosAccesorios: 0,
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

    // avisarRentaConfirmada solo avisa si la entrega es hoy o mañana.
    if (d.estado === "CONFIRMADA") avisar(() => avisarRentaConfirmada(rentaId));

    return { ok: true, id: rentaId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear la renta." };
  }
}

// ---------- Editar renta ----------
// Reglas de qué se puede editar: ver ESTADOS_EDITABLES / UNIDADES_BLOQUEADAS en lib/rentas.
const editarSchema = crearSchema.omit({ estado: true, anticipo: true });
export type EditarRentaInput = z.input<typeof editarSchema>;

export async function editarRenta(
  rentaId: string,
  input: EditarRentaInput,
): Promise<RentaActionResult> {
  const parsed = editarSchema.safeParse(input);
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
    await prisma.$transaction(async (tx) => {
      const renta = await tx.renta.findUnique({
        where: { id: rentaId },
        include: { unidades: true },
      });
      if (!renta) throw new Error("Renta no encontrada.");
      if (!ESTADOS_EDITABLES.includes(renta.estado)) {
        throw new Error(`No se puede editar una renta ${renta.estado.toLowerCase()}.`);
      }

      const actuales = renta.unidades.map((u) => u.unidadId).sort();
      const nuevasIds = [...d.unidadIds].sort();
      const mismasUnidades =
        actuales.length === nuevasIds.length && actuales.every((v, i) => v === nuevasIds[i]);
      if (UNIDADES_BLOQUEADAS.includes(renta.estado) && !mismasUnidades) {
        throw new Error(
          "Con el equipo ya entregado las unidades no se cambian; solo fechas, datos y cargos.",
        );
      }

      // Revalidar disponibilidad para el nuevo rango, ignorando esta renta.
      // Las rentas cerradas no apartan inventario: revalidarlas rechazaría
      // correcciones al histórico sin que exista conflicto real.
      if (!ESTADOS_CERRADOS.includes(renta.estado)) {
        const ocupadas = await unidadesNoDisponibles(d.unidadIds, inicio, fin, rentaId, tx);
        if (ocupadas.length > 0) {
          throw new Error(
            `Ya no están disponibles: ${ocupadas.join(", ")}. Actualiza la selección.`,
          );
        }
      }

      const unidades = await tx.unidad.findMany({
        where: { id: { in: d.unidadIds } },
        include: { modelo: true },
      });
      const unidadesCalc: UnidadCalc[] = unidades.map((u) => ({
        id: u.id,
        tipo: u.modelo.tipo,
        precioDia: u.modelo.precioDia,
        precioDia3Mas: u.modelo.precioDia3Mas,
      }));
      // Los accesorios se capturan hasta la entrega (marcarEntregada), sin costo.
      const calc = calcularRenta({
        unidades: unidadesCalc,
        dias: diasDeRenta(inicio, fin),
        costoDomicilio: d.costoDomicilio,
        cargosAccesorios: 0,
        descuentoMonto: d.descuentoMonto,
      });
      const precioPorUnidad = new Map(calc.unidades.map((u) => [u.id, u.precioEfectivo]));

      // Reemplazar unidades con los snapshots recalculados (el total que se ve
      // en el formulario es el que queda guardado). Los accesorios no se tocan
      // aquí: se capturan al marcar la renta como entregada.
      await tx.rentaUnidad.deleteMany({ where: { rentaId } });
      await tx.renta.update({
        where: { id: rentaId },
        data: {
          clienteId: d.clienteId,
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
        },
      });
    });

    revalidatePath("/rentas");
    revalidatePath(`/rentas/${rentaId}`);
    revalidatePath("/");
    return { ok: true, id: rentaId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo editar la renta." };
  }
}

// ---------- Flujo de estados ----------

// Quién está marcando la entrega (para el aviso al admin, y para no avisarle a
// sí mismo). Nunca lanza: un fallo aquí no debe tumbar el cambio de estado, que
// ya está guardado.
async function actorActual(): Promise<{ id: string; nombre: string } | null> {
  if (!AUTH_HABILITADA) return null;
  try {
    const session = await auth();
    const u = session?.user;
    return u?.id ? { id: u.id, nombre: u.name ?? "alguien del equipo" } : null;
  } catch {
    return null;
  }
}

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

    // Los avisos salen después de responder (avisar → after) y nunca propagan
    // errores: si el push falla, el cambio de estado igual quedó guardado.
    if (nuevoEstado === "CONFIRMADA") {
      avisar(() => avisarRentaConfirmada(rentaId));
    } else if (nuevoEstado === "ENTREGADA" || nuevoEstado === "RECOGIDA") {
      const actor = await actorActual();
      avisar(() => avisarEntregaMarcada(rentaId, nuevoEstado, actor));
    }

    return { ok: true, id: rentaId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cambiar el estado." };
  }
}

// Qué accesorios aplican a cada tipo de equipo (mismo mapeo que antes vivía
// en el formulario de renta).
const TIPO_ACCESORIO_POR_EQUIPO: Record<string, ("MANGUERA" | "EXTENSION" | "TAMBO_GAS")[]> = {
  AEROCOOLER: ["MANGUERA", "EXTENSION"],
  CALENTON: ["TAMBO_GAS"],
};

export type AccesorioOpcion = {
  id: string;
  descripcion: string;
  tipo: string;
  codigo: string | null;
};

// Catálogo de accesorios aplicable a los tipos de equipo dados (para el
// diálogo de "marcar entregado").
export async function accesoriosParaEquipos(tipos: string[]): Promise<AccesorioOpcion[]> {
  const tiposAccesorio = [...new Set(tipos.flatMap((t) => TIPO_ACCESORIO_POR_EQUIPO[t] ?? []))];
  if (tiposAccesorio.length === 0) return [];
  return prisma.accesorio.findMany({
    where: { tipo: { in: tiposAccesorio } },
    select: { id: true, descripcion: true, tipo: true, codigo: true },
    orderBy: [{ tipo: "asc" }, { codigo: "asc" }],
  });
}

// Marca la renta como ENTREGADA y registra qué accesorios salieron con el
// equipo: esa información solo se sabe al entregar, no antes, y no tiene
// costo (a diferencia del histórico migrado, donde el gas sí se cobraba).
export async function marcarEntregada(
  rentaId: string,
  accesorioIds: string[],
): Promise<RentaActionResult> {
  try {
    await prisma.$transaction(async (tx) => {
      const renta = await tx.renta.findUnique({
        where: { id: rentaId },
        include: { unidades: true },
      });
      if (!renta) throw new Error("Renta no encontrada.");
      if (!TRANSICIONES[renta.estado].includes("ENTREGADA")) {
        throw new Error(`No se puede pasar de ${renta.estado} a ENTREGADA.`);
      }

      const unidadIds = renta.unidades.map((u) => u.unidadId);
      if (unidadIds.length) {
        await tx.unidad.updateMany({
          where: { id: { in: unidadIds } },
          data: { estado: "RENTADA" },
        });
      }

      await tx.rentaAccesorio.deleteMany({ where: { rentaId } });
      if (accesorioIds.length) {
        await tx.rentaAccesorio.createMany({
          data: accesorioIds.map((accesorioId) => ({ rentaId, accesorioId, cargo: 0 })),
        });
      }

      await tx.renta.update({ where: { id: rentaId }, data: { estado: "ENTREGADA" } });
    });

    revalidatePath("/rentas");
    revalidatePath(`/rentas/${rentaId}`);
    revalidatePath("/");

    const actor = await actorActual();
    avisar(() => avisarEntregaMarcada(rentaId, "ENTREGADA", actor));

    return { ok: true, id: rentaId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo marcar como entregada." };
  }
}

// Corrección de estado (solo admin): salta el flujo normal (TRANSICIONES) para
// arreglar errores de captura, p. ej. una renta marcada CONCLUIDA que en
// realidad sigue CONFIRMADA. Si el nuevo estado vuelve a ocupar inventario
// (activo) y el actual no lo hacía, revalida que las unidades sigan libres en
// esas fechas para no crear un doble apartado silencioso.
export async function corregirEstadoRenta(
  rentaId: string,
  nuevoEstado: EstadoRenta,
): Promise<RentaActionResult> {
  if (!(await esAdmin())) {
    return { error: "Solo el administrador puede corregir el estado." };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const renta = await tx.renta.findUnique({
        where: { id: rentaId },
        include: { unidades: true },
      });
      if (!renta) throw new Error("Renta no encontrada.");
      if (renta.estado === nuevoEstado) return;

      const unidadIds = renta.unidades.map((u) => u.unidadId);
      const eraActivo = ESTADOS_ACTIVOS.includes(renta.estado as (typeof ESTADOS_ACTIVOS)[number]);
      const seraActivo = ESTADOS_ACTIVOS.includes(nuevoEstado as (typeof ESTADOS_ACTIVOS)[number]);

      if (seraActivo && !eraActivo && unidadIds.length) {
        const ocupadas = await unidadesNoDisponibles(
          unidadIds,
          renta.fechaInicio,
          renta.fechaFin,
          rentaId,
          tx,
        );
        if (ocupadas.length > 0) {
          throw new Error(
            `No se puede corregir: ${ocupadas.join(", ")} ya está(n) ocupada(s) en esas fechas.`,
          );
        }
      }

      // Reflejar el estado físico del equipo: solo ENTREGADA lo deja "en la
      // calle"; cualquier otra corrección lo regresa a disponible.
      if (unidadIds.length) {
        await tx.unidad.updateMany({
          where: { id: { in: unidadIds } },
          data: { estado: nuevoEstado === "ENTREGADA" ? "RENTADA" : "DISPONIBLE" },
        });
      }

      await tx.renta.update({ where: { id: rentaId }, data: { estado: nuevoEstado } });
    });

    revalidatePath("/rentas");
    revalidatePath(`/rentas/${rentaId}`);
    revalidatePath("/");
    return { ok: true, id: rentaId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo corregir el estado." };
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

// Corrige un pago capturado por error (solo admin): p. ej. se marcó una
// liquidación que en realidad nunca se cobró.
export async function eliminarPago(
  rentaId: string,
  pagoId: string,
): Promise<RentaActionResult> {
  if (!(await esAdmin())) {
    return { error: "Solo el administrador puede eliminar un pago." };
  }
  const pago = await prisma.pago.findUnique({ where: { id: pagoId } });
  if (!pago || pago.rentaId !== rentaId) return { error: "Pago no encontrado." };

  await prisma.pago.delete({ where: { id: pagoId } });

  revalidatePath(`/rentas/${rentaId}`);
  revalidatePath("/rentas");
  revalidatePath("/");
  return { ok: true, id: rentaId };
}
