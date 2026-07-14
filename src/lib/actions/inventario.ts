"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type InventarioActionResult = { ok: true } | { error: string };

function fallo(e: unknown, porDefecto: string): InventarioActionResult {
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
