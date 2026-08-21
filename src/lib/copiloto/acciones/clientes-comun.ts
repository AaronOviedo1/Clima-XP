import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopeNegocio, type ContextoCopiloto } from "../contexto";
import { ArgsInvalidos } from "../tool";
import { normalizarTelefono } from "@/lib/telefono";

// Cómo identifica el modelo al cliente de una renta nueva: por id (lo devolvió
// historial_cliente / buscar_rentas), por búsqueda (nombre o teléfono; tiene
// que dar UNA coincidencia) o como cliente nuevo (se crea al CONFIRMAR, no al
// proponer, para no dejar clientes huérfanos de propuestas canceladas).

export type ClienteResuelto =
  | { tipo: "existente"; clienteId: string; nombre: string; telefono: string | null }
  | { tipo: "nuevo"; nombre: string; telefono: string | null };

const MAX_LISTA = 5;

export async function resolverCliente(
  args: {
    clienteId?: string;
    busquedaCliente?: string;
    clienteNuevo?: { nombre: string; telefono?: string };
  },
  ctx: ContextoCopiloto,
): Promise<ClienteResuelto> {
  const dados = [args.clienteId, args.busquedaCliente, args.clienteNuevo].filter(Boolean).length;
  if (dados !== 1) {
    throw new ArgsInvalidos(
      "Indica exactamente uno: clienteId (lo devuelven historial_cliente y buscar_rentas), busquedaCliente (nombre o teléfono) o clienteNuevo {nombre, telefono}.",
    );
  }

  if (args.clienteId) {
    const c = await prisma.cliente.findFirst({
      where: { id: args.clienteId, ...scopeNegocio(ctx) },
      select: { id: true, nombre: true, telefono: true },
    });
    if (!c) throw new ArgsInvalidos("No existe un cliente con ese clienteId; búscalo con historial_cliente.");
    return { tipo: "existente", clienteId: c.id, nombre: c.nombre, telefono: c.telefono };
  }

  if (args.busquedaCliente) {
    const q = args.busquedaCliente;
    const digitos = q.replace(/\D/g, "");
    const where: Prisma.ClienteWhereInput = {
      ...scopeNegocio(ctx),
      OR: [
        { nombre: { contains: q, mode: "insensitive" } },
        ...(digitos.length >= 4 ? [{ telefono: { contains: digitos } }] : []),
      ],
    };
    const [n, lista] = await Promise.all([
      prisma.cliente.count({ where }),
      prisma.cliente.findMany({
        where,
        select: { id: true, nombre: true, telefono: true },
        orderBy: { nombre: "asc" },
        take: MAX_LISTA,
      }),
    ]);
    if (n === 0) {
      throw new ArgsInvalidos(
        `No hay ningún cliente que coincida con "${q}". Si es cliente nuevo, pide nombre y teléfono y manda clienteNuevo.`,
      );
    }
    if (n > 1) {
      const opciones = lista.map((c) => `${c.nombre}${c.telefono ? ` (${c.telefono})` : ""} → clienteId ${c.id}`).join("; ");
      throw new ArgsInvalidos(
        `Hay ${n} clientes que coinciden con "${q}": ${opciones}${n > MAX_LISTA ? "; …" : ""}. Pregunta a la persona cuál y vuelve a proponer con su clienteId.`,
      );
    }
    const c = lista[0];
    return { tipo: "existente", clienteId: c.id, nombre: c.nombre, telefono: c.telefono };
  }

  const nuevo = args.clienteNuevo!;
  const telefono = normalizarTelefono(nuevo.telefono);
  if (nuevo.telefono && !telefono) {
    throw new ArgsInvalidos(
      `El teléfono "${nuevo.telefono}" no parece un número mexicano de 10 dígitos; confírmalo con la persona.`,
    );
  }
  if (telefono) {
    const existente = await prisma.cliente.findFirst({
      where: { telefono, ...scopeNegocio(ctx) },
      select: { id: true, nombre: true },
    });
    if (existente) {
      throw new ArgsInvalidos(
        `Ya existe un cliente con ese teléfono: ${existente.nombre} (clienteId ${existente.id}). Propón con ese clienteId en vez de crear otro.`,
      );
    }
  }
  return { tipo: "nuevo", nombre: nuevo.nombre, telefono };
}
