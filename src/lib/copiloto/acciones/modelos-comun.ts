import "server-only";
import { prisma } from "@/lib/prisma";
import { ArgsInvalidos } from "../tool";

// Cómo nombra el modelo (y la persona) a los equipos: por nombre del modelo
// ("Eco-Fresco", "fire sense") o por tipo ("calentones"), que vale solo si hay
// un único modelo rentable de ese tipo. Lo comparten proponer_renta y
// proponer_editar_renta.

export const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const PALABRAS_TIPO: Record<string, "AEROCOOLER" | "CALENTON"> = {
  aerocooler: "AEROCOOLER", aerocoolers: "AEROCOOLER", cooler: "AEROCOOLER", coolers: "AEROCOOLER",
  enfriador: "AEROCOOLER", enfriadores: "AEROCOOLER",
  calenton: "CALENTON", calentones: "CALENTON", calefactor: "CALENTON", calefactores: "CALENTON",
  calentador: "CALENTON", calentadores: "CALENTON",
};

export type ModeloCat = {
  id: string;
  nombre: string;
  tipo: "AEROCOOLER" | "CALENTON";
  precioDia: number;
  precioDia3Mas: number | null;
  unidades: number; // cuántas unidades existen (0 = todavía no se puede rentar)
};

export async function cargarCatalogo(): Promise<ModeloCat[]> {
  const modelos = await prisma.modeloEquipo.findMany({
    select: {
      id: true,
      nombre: true,
      tipo: true,
      precioDia: true,
      precioDia3Mas: true,
      _count: { select: { unidades: true } },
    },
  });
  return modelos.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    tipo: m.tipo,
    precioDia: m.precioDia,
    precioDia3Mas: m.precioDia3Mas,
    unidades: m._count.unidades,
  }));
}

// Nombre de modelo o tipo → un modelo del catálogo, o error que explica qué hay.
export function elegirModelo(texto: string, catalogo: ModeloCat[]): ModeloCat {
  const q = normalizar(texto);
  const conUnidades = catalogo.filter((m) => m.unidades > 0);
  const nombres = conUnidades.map((m) => m.nombre).join(", ");
  const porTipo = PALABRAS_TIPO[q];
  if (porTipo) {
    const delTipo = conUnidades.filter((m) => m.tipo === porTipo);
    if (delTipo.length === 1) return delTipo[0];
    throw new ArgsInvalidos(
      `"${texto}" es ambiguo: hay ${delTipo.length} modelos de ese tipo (${delTipo.map((m) => m.nombre).join(", ")}). Pregunta cuál.`,
    );
  }
  const exactos = catalogo.filter((m) => normalizar(m.nombre) === q);
  const parciales = exactos.length
    ? exactos
    : catalogo.filter((m) => normalizar(m.nombre).includes(q) || q.includes(normalizar(m.nombre)));
  if (parciales.length === 0) {
    throw new ArgsInvalidos(`No existe el modelo "${texto}". Los modelos rentables son: ${nombres}.`);
  }
  if (parciales.length > 1) {
    throw new ArgsInvalidos(
      `"${texto}" coincide con varios modelos (${parciales.map((m) => m.nombre).join(", ")}). Pregunta cuál.`,
    );
  }
  const m = parciales[0];
  if (m.unidades === 0) {
    throw new ArgsInvalidos(`${m.nombre} todavía no tiene unidades para rentar. Los modelos rentables son: ${nombres}.`);
  }
  return m;
}

// "2 Eco-Fresco + 1 Eco-Fresco" se junta; devuelve el pedido por modelo.
export function agruparPedido(
  equipos: { modelo: string; cantidad: number }[],
  catalogo: ModeloCat[],
): Map<string, { modelo: ModeloCat; cantidad: number }> {
  const pedido = new Map<string, { modelo: ModeloCat; cantidad: number }>();
  for (const e of equipos) {
    const m = elegirModelo(e.modelo, catalogo);
    const prev = pedido.get(m.id);
    pedido.set(m.id, { modelo: m, cantidad: (prev?.cantidad ?? 0) + e.cantidad });
  }
  return pedido;
}
