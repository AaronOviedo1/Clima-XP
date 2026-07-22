import { prisma } from "@/lib/prisma";

export type ModeloInventario = Awaited<ReturnType<typeof datosInventario>>["modelos"][number];

// `corto` es la etiqueta de los chips de conteo ("3 disp.", "1 mant.") y `chip`
// el par de color con el que se pintan tanto esos chips como el código de cada
// unidad; `clase` es solo el color del texto (punto de estado, listas).
export const ESTADO_UNIDAD_META: Record<
  string,
  {
    label: string;
    corto: string;
    badge: "default" | "secondary" | "destructive" | "outline";
    clase: string;
    chip: string;
  }
> = {
  DISPONIBLE: {
    label: "Disponible",
    corto: "disp.",
    badge: "secondary",
    clase: "text-emerald-600 dark:text-emerald-500",
    chip: "bg-chip-verde text-chip-verde-fg",
  },
  RENTADA: {
    label: "Rentada",
    corto: "en renta",
    badge: "default",
    clase: "text-blue-600 dark:text-blue-500",
    chip: "bg-chip-cielo text-chip-cielo-fg",
  },
  MANTENIMIENTO: {
    label: "Mantenimiento",
    corto: "mant.",
    badge: "outline",
    clase: "text-amber-600 dark:text-amber-500",
    chip: "bg-chip-ambar text-chip-ambar-fg",
  },
  BAJA: {
    label: "Baja",
    corto: "baja",
    badge: "destructive",
    clase: "text-destructive",
    chip: "bg-muted text-tenue",
  },
};

// Orden fijo de los chips de conteo (el del mockup), para que no baile según
// qué estados tenga cada modelo.
export const ORDEN_ESTADO_UNIDAD = [
  "DISPONIBLE",
  "RENTADA",
  "MANTENIMIENTO",
  "BAJA",
] as const;

// Etiquetas legibles para las claves de specs.
export const SPEC_LABELS: Record<string, string> = {
  flujoAire: "Flujo de aire",
  areaEnfriamiento: "Área de enfriamiento",
  areaQueCalienta: "Área que calienta",
  ruido: "Ruido",
  peso: "Peso",
  potenciaMotor: "Potencia motor",
  capacidadAgua: "Capacidad de agua",
  dimensiones: "Dimensiones",
  voltaje: "Voltaje",
  marca: "Marca",
  gas: "Gas",
  material: "Material",
  altura: "Altura",
  casco: "Casco",
  base: "Base",
  color: "Color",
  cantidad: "Cantidad",
};

export async function datosInventario() {
  const [modelos, accesorios, mantenimientos] = await Promise.all([
    prisma.modeloEquipo.findMany({
      include: { unidades: { orderBy: { codigo: "asc" } } },
      orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
    }),
    prisma.accesorio.findMany({ orderBy: [{ tipo: "asc" }, { codigo: "asc" }] }),
    prisma.mantenimiento.findMany({
      where: { resuelto: false },
      include: { unidad: { include: { modelo: true } } },
      orderBy: { fecha: "desc" },
    }),
  ]);

  const totalUnidades = modelos.reduce((a, m) => a + m.unidades.length, 0);
  const disponibles = modelos.reduce(
    (a, m) => a + m.unidades.filter((u) => u.estado === "DISPONIBLE").length,
    0,
  );
  const enMantenimiento = modelos.reduce(
    (a, m) => a + m.unidades.filter((u) => u.estado === "MANTENIMIENTO").length,
    0,
  );
  const rentadas = modelos.reduce(
    (a, m) => a + m.unidades.filter((u) => u.estado === "RENTADA").length,
    0,
  );
  const tambosLlenos = accesorios.filter(
    (a) => a.tipo === "TAMBO_GAS" && a.estadoTambo === "LLENO",
  ).length;

  return {
    modelos,
    accesorios,
    mantenimientos,
    kpis: { totalUnidades, disponibles, enMantenimiento, rentadas, tambosLlenos },
  };
}

// Cuenta unidades por estado para un modelo.
export function conteoPorEstado(unidades: { estado: string }[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const u of unidades) c[u.estado] = (c[u.estado] ?? 0) + 1;
  return c;
}
