"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizarTelefono } from "@/lib/telefono";

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
