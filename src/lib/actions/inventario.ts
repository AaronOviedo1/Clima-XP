"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { esAdmin } from "@/lib/auth-guard";
import type { LoteActionResult } from "@/lib/lote";

export type InventarioActionResult = { ok: true } | { error: string };

function fallo(e: unknown, porDefecto: string): { error: string } {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return { error: "Ese código ya existe." };
  }
  return { error: e instanceof Error ? e.message : porDefecto };
}

function refrescar() {
  revalidatePath("/inventario");
  revalidatePath("/");
}

// ---------- Modelos ----------
const preciosSchema = z.object({
  precioDia: z.number().int().positive("El precio por día debe ser mayor a 0"),
  precioDia3Mas: z.number().int().positive().nullable(),
});

export async function editarPreciosModelo(
  modeloId: string,
  input: z.input<typeof preciosSchema>,
): Promise<InventarioActionResult> {
  const parsed = preciosSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await prisma.modeloEquipo.update({ where: { id: modeloId }, data: parsed.data });
    refrescar();
    return { ok: true };
  } catch (e) {
    return fallo(e, "No se pudo actualizar el precio.");
  }
}

// ---------- Unidades ----------
const unidadSchema = z.object({
  codigo: z.string().trim().min(1, "El código es obligatorio"),
  estado: z.enum(["DISPONIBLE", "RENTADA", "MANTENIMIENTO", "BAJA"]),
  notas: z.string().trim().optional().nullable(),
});

export async function crearUnidad(
  modeloId: string,
  input: { codigo: string; notas?: string | null },
): Promise<InventarioActionResult> {
  const codigo = input.codigo?.trim();
  if (!codigo) return { error: "El código es obligatorio." };
  try {
    await prisma.unidad.create({
      data: { modeloId, codigo, notas: input.notas?.trim() || null },
    });
    refrescar();
    return { ok: true };
  } catch (e) {
    return fallo(e, "No se pudo crear la unidad.");
  }
}

export async function editarUnidad(
  unidadId: string,
  input: z.input<typeof unidadSchema>,
): Promise<InventarioActionResult> {
  const parsed = unidadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await prisma.unidad.update({
      where: { id: unidadId },
      data: {
        codigo: parsed.data.codigo,
        estado: parsed.data.estado,
        notas: parsed.data.notas || null,
      },
    });
    refrescar();
    return { ok: true };
  } catch (e) {
    return fallo(e, "No se pudo actualizar la unidad.");
  }
}

export async function eliminarUnidad(unidadId: string): Promise<InventarioActionResult> {
  try {
    const rentas = await prisma.rentaUnidad.count({ where: { unidadId } });
    if (rentas > 0) {
      return {
        error:
          "La unidad tiene rentas asociadas; márcala como Baja para conservar el historial.",
      };
    }
    await prisma.$transaction([
      prisma.mantenimiento.deleteMany({ where: { unidadId } }),
      prisma.unidad.delete({ where: { id: unidadId } }),
    ]);
    refrescar();
    return { ok: true };
  } catch (e) {
    return fallo(e, "No se pudo eliminar la unidad.");
  }
}

// ---------- Unidades en lote (edición masiva) ----------
const loteSchema = z.object({
  unidadIds: z.array(z.string().min(1)).min(1, "Selecciona al menos una unidad"),
  // `undefined` = no tocar el campo; `null`/"" en notas = limpiarlas.
  estado: z.enum(["DISPONIBLE", "RENTADA", "MANTENIMIENTO", "BAJA"]).optional(),
  notas: z.string().trim().nullable().optional(),
});

export async function editarUnidadesEnLote(
  input: z.input<typeof loteSchema>,
): Promise<LoteActionResult> {
  if (!(await esAdmin())) {
    return { error: "Solo un administrador puede editar el inventario." };
  }
  const parsed = loteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { unidadIds, estado, notas } = parsed.data;
  if (!estado && notas === undefined) {
    return { error: "Elige un estado o unas notas para aplicar." };
  }
  try {
    const data: Prisma.UnidadUpdateManyMutationInput = {};
    if (estado) data.estado = estado;
    if (notas !== undefined) data.notas = notas || null;

    const afectadas = await prisma.$transaction(async (tx) => {
      const res = await tx.unidad.updateMany({ where: { id: { in: unidadIds } }, data });
      // Regresar unidades a DISPONIBLE cierra sus mantenimientos abiertos: si no,
      // seguirían saliendo en la lista de "Mantenimientos abiertos" del inventario.
      if (estado === "DISPONIBLE") {
        await tx.mantenimiento.updateMany({
          where: { unidadId: { in: unidadIds }, resuelto: false },
          data: { resuelto: true },
        });
      }
      return res.count;
    });
    refrescar();
    return { ok: true, afectadas, omitidas: [] };
  } catch (e) {
    return fallo(e, "No se pudieron actualizar las unidades.");
  }
}

export async function eliminarUnidadesEnLote(
  unidadIds: string[],
): Promise<LoteActionResult> {
  if (!(await esAdmin())) {
    return { error: "Solo un administrador puede editar el inventario." };
  }
  if (!unidadIds?.length) return { error: "Selecciona al menos una unidad." };
  try {
    // Las unidades con historial de rentas no se borran (igual que en el alta
    // individual): se informan como omitidas para que se marquen como Baja.
    const conRentas = await prisma.rentaUnidad.findMany({
      where: { unidadId: { in: unidadIds } },
      select: { unidadId: true },
      distinct: ["unidadId"],
    });
    const bloqueadas = new Set(conRentas.map((r) => r.unidadId));
    const borrables = unidadIds.filter((id) => !bloqueadas.has(id));
    const omitidas = bloqueadas.size
      ? (
          await prisma.unidad.findMany({
            where: { id: { in: [...bloqueadas] } },
            select: { codigo: true },
            orderBy: { codigo: "asc" },
          })
        ).map((u) => u.codigo)
      : [];

    if (borrables.length) {
      await prisma.$transaction([
        prisma.mantenimiento.deleteMany({ where: { unidadId: { in: borrables } } }),
        prisma.unidad.deleteMany({ where: { id: { in: borrables } } }),
      ]);
      refrescar();
    }
    return { ok: true, afectadas: borrables.length, omitidas };
  } catch (e) {
    return fallo(e, "No se pudieron eliminar las unidades.");
  }
}

// ---------- Mantenimientos ----------
export async function reportarMantenimiento(
  unidadId: string,
  input: { descripcion: string; costo?: number | null },
): Promise<InventarioActionResult> {
  const descripcion = input.descripcion?.trim();
  if (!descripcion) return { error: "Describe la falla." };
  try {
    await prisma.$transaction([
      prisma.mantenimiento.create({
        data: { unidadId, descripcion, costo: input.costo ?? null },
      }),
      prisma.unidad.update({
        where: { id: unidadId },
        data: { estado: "MANTENIMIENTO" },
      }),
    ]);
    refrescar();
    return { ok: true };
  } catch (e) {
    return fallo(e, "No se pudo reportar el mantenimiento.");
  }
}

export async function resolverMantenimiento(
  mantenimientoId: string,
): Promise<InventarioActionResult> {
  try {
    await prisma.$transaction(async (tx) => {
      const mant = await tx.mantenimiento.update({
        where: { id: mantenimientoId },
        data: { resuelto: true },
        include: { unidad: true },
      });
      // Si la unidad quedó sin mantenimientos abiertos, vuelve a estar disponible.
      const abiertos = await tx.mantenimiento.count({
        where: { unidadId: mant.unidadId, resuelto: false },
      });
      if (abiertos === 0 && mant.unidad.estado === "MANTENIMIENTO") {
        await tx.unidad.update({
          where: { id: mant.unidadId },
          data: { estado: "DISPONIBLE" },
        });
      }
    });
    refrescar();
    return { ok: true };
  } catch (e) {
    return fallo(e, "No se pudo resolver el mantenimiento.");
  }
}

// ---------- Accesorios ----------
const accesorioSchema = z.object({
  tipo: z.enum(["MANGUERA", "EXTENSION", "TAMBO_GAS"]),
  descripcion: z.string().trim().min(1, "La descripción es obligatoria"),
  codigo: z.string().trim().optional().nullable(),
});

export async function crearAccesorio(
  input: z.input<typeof accesorioSchema>,
): Promise<InventarioActionResult> {
  const parsed = accesorioSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await prisma.accesorio.create({
      data: {
        tipo: parsed.data.tipo,
        descripcion: parsed.data.descripcion,
        codigo: parsed.data.codigo || null,
        estadoTambo: parsed.data.tipo === "TAMBO_GAS" ? "LLENO" : null,
      },
    });
    refrescar();
    return { ok: true };
  } catch (e) {
    return fallo(e, "No se pudo crear el accesorio.");
  }
}

export async function eliminarAccesorio(
  accesorioId: string,
): Promise<InventarioActionResult> {
  try {
    const usos = await prisma.rentaAccesorio.count({ where: { accesorioId } });
    if (usos > 0) {
      return { error: "El accesorio tiene rentas asociadas; no se puede eliminar." };
    }
    await prisma.accesorio.delete({ where: { id: accesorioId } });
    refrescar();
    return { ok: true };
  } catch (e) {
    return fallo(e, "No se pudo eliminar el accesorio.");
  }
}

export async function cambiarEstadoTambo(
  accesorioId: string,
  estado: "LLENO" | "VACIO" | "EN_CLIENTE",
): Promise<InventarioActionResult> {
  try {
    await prisma.accesorio.update({
      where: { id: accesorioId, tipo: "TAMBO_GAS" },
      data: { estadoTambo: estado },
    });
    refrescar();
    return { ok: true };
  } catch (e) {
    return fallo(e, "No se pudo cambiar el estado del tambo.");
  }
}
