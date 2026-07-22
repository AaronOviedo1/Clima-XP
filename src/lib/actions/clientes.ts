"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizarTelefono } from "@/lib/telefono";
import { esAdmin } from "@/lib/auth-guard";
import type { LoteActionResult } from "@/lib/lote";

const clienteSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  telefono: z.string().trim().optional().nullable(),
  canalOrigen: z
    .enum(["MESSENGER", "WHATSAPP", "RECOMENDACION", "RECURRENTE", "OTRO"])
    .default("WHATSAPP"),
  notas: z.string().trim().optional().nullable(),
});

export type ClienteFormState =
  | {
      error?: string;
      campos?: Record<string, string>;
      duplicado?: { id: string; nombre: string };
    }
  | undefined;

function parseForm(formData: FormData) {
  return clienteSchema.safeParse({
    nombre: formData.get("nombre"),
    telefono: formData.get("telefono") || null,
    canalOrigen: formData.get("canalOrigen") || "WHATSAPP",
    notas: formData.get("notas") || null,
  });
}

export async function crearCliente(
  _prev: ClienteFormState,
  formData: FormData,
): Promise<ClienteFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { nombre, canalOrigen, notas } = parsed.data;
  const telefono = normalizarTelefono(parsed.data.telefono ?? undefined);
  const forzar = formData.get("forzar") === "1";

  if (parsed.data.telefono && !telefono) {
    return { error: "El teléfono no parece válido (debe ser un número mexicano de 10 dígitos)." };
  }

  // Detección de duplicados por teléfono
  if (telefono && !forzar) {
    const existente = await prisma.cliente.findFirst({ where: { telefono } });
    if (existente) {
      return { duplicado: { id: existente.id, nombre: existente.nombre } };
    }
  }

  const cliente = await prisma.cliente.create({
    data: { nombre, telefono, canalOrigen, notas },
  });
  revalidatePath("/clientes");
  redirect(`/clientes/${cliente.id}`);
}

export type ClienteRapidoResult =
  | { cliente: { id: string; nombre: string; telefono: string | null } }
  | { duplicado: { id: string; nombre: string; telefono: string | null } }
  | { error: string };

// Crea un cliente desde el formulario de renta: devuelve el cliente en vez de redirigir.
export async function crearClienteRapido(datos: {
  nombre: string;
  telefono?: string | null;
  canalOrigen?: string;
  forzar?: boolean;
}): Promise<ClienteRapidoResult> {
  const parsed = clienteSchema.safeParse({
    nombre: datos.nombre,
    telefono: datos.telefono || null,
    canalOrigen: datos.canalOrigen || "WHATSAPP",
    notas: null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { nombre, canalOrigen, notas } = parsed.data;
  const telefono = normalizarTelefono(parsed.data.telefono ?? undefined);

  if (parsed.data.telefono && !telefono) {
    return { error: "El teléfono no parece válido (debe ser un número mexicano de 10 dígitos)." };
  }

  if (telefono && !datos.forzar) {
    const existente = await prisma.cliente.findFirst({ where: { telefono } });
    if (existente) {
      return {
        duplicado: {
          id: existente.id,
          nombre: existente.nombre,
          telefono: existente.telefono,
        },
      };
    }
  }

  const cliente = await prisma.cliente.create({
    data: { nombre, telefono, canalOrigen, notas },
    select: { id: true, nombre: true, telefono: true },
  });
  revalidatePath("/clientes");
  return { cliente };
}

export async function editarCliente(
  id: string,
  _prev: ClienteFormState,
  formData: FormData,
): Promise<ClienteFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { nombre, canalOrigen, notas } = parsed.data;
  const telefono = normalizarTelefono(parsed.data.telefono ?? undefined);

  if (parsed.data.telefono && !telefono) {
    return { error: "El teléfono no parece válido." };
  }

  if (telefono) {
    const otro = await prisma.cliente.findFirst({
      where: { telefono, id: { not: id } },
    });
    if (otro) {
      return { duplicado: { id: otro.id, nombre: otro.nombre } };
    }
  }

  await prisma.cliente.update({
    data: { nombre, telefono, canalOrigen, notas },
    where: { id },
  });
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

// ---------- Clientes en lote (edición masiva) ----------
const loteSchema = z.object({
  clienteIds: z.array(z.string().min(1)).min(1, "Selecciona al menos un cliente"),
  // `undefined` = no tocar el campo; `null`/"" en notas = limpiarlas.
  canalOrigen: z
    .enum(["MESSENGER", "WHATSAPP", "RECOMENDACION", "RECURRENTE", "OTRO"])
    .optional(),
  notas: z.string().trim().nullable().optional(),
});

export async function editarClientesEnLote(
  input: z.input<typeof loteSchema>,
): Promise<LoteActionResult> {
  if (!(await esAdmin())) {
    return { error: "Solo un administrador puede editar clientes." };
  }
  const parsed = loteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { clienteIds, canalOrigen, notas } = parsed.data;
  if (!canalOrigen && notas === undefined) {
    return { error: "Elige un origen o unas notas para aplicar." };
  }
  try {
    const { count } = await prisma.cliente.updateMany({
      where: { id: { in: clienteIds } },
      data: {
        ...(canalOrigen ? { canalOrigen } : {}),
        ...(notas !== undefined ? { notas: notas || null } : {}),
      },
    });
    revalidatePath("/clientes");
    return { ok: true, afectadas: count, omitidas: [] };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No se pudieron actualizar los clientes.",
    };
  }
}

export async function eliminarClientesEnLote(
  clienteIds: string[],
): Promise<LoteActionResult> {
  if (!(await esAdmin())) {
    return { error: "Solo un administrador puede eliminar clientes." };
  }
  if (!clienteIds?.length) return { error: "Selecciona al menos un cliente." };
  try {
    // Un cliente con rentas es historial: no se borra, se informa como omitido.
    const conRentas = await prisma.cliente.findMany({
      where: { id: { in: clienteIds }, rentas: { some: {} } },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    });
    const bloqueados = new Set(conRentas.map((c) => c.id));
    const borrables = clienteIds.filter((id) => !bloqueados.has(id));

    if (borrables.length) {
      await prisma.cliente.deleteMany({ where: { id: { in: borrables } } });
      revalidatePath("/clientes");
    }
    return {
      ok: true,
      afectadas: borrables.length,
      omitidas: conRentas.map((c) => c.nombre),
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No se pudieron eliminar los clientes.",
    };
  }
}
