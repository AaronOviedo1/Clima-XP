import { prisma } from "@/lib/prisma";

export type SugerenciaDomicilio = {
  kmConsultado: number;
  kmTarifa: number; // km redondeado usado para la tarifa
  costo: number;
  fueraDeRango: boolean; // true si se topó al mínimo o máximo de la tabla
};

/**
 * Sugerencia de costo de domicilio a partir de la distancia en km, usando la
 * tabla de tarifas (modelo ZonaEnvio: kmMax = km, costo = precio de ese km).
 * Redondea la distancia hacia arriba al km más cercano y la limita al rango
 * cubierto por la tabla. El admin siempre puede sobrescribir el costo.
 */
export async function sugerirCostoDomicilio(
  km: number,
): Promise<SugerenciaDomicilio | null> {
  const tarifas = await prisma.zonaEnvio.findMany({
    orderBy: { kmMax: "asc" },
    select: { kmMax: true, costo: true },
  });
  if (tarifas.length === 0 || !Number.isFinite(km) || km <= 0) return null;

  const kmMin = tarifas[0].kmMax;
  const kmMax = tarifas[tarifas.length - 1].kmMax;
  const kmRedondeado = Math.ceil(km);
  const kmTarifa = Math.min(Math.max(kmRedondeado, kmMin), kmMax);
  const fueraDeRango = kmRedondeado < kmMin || kmRedondeado > kmMax;

  // Primer tramo cuyo kmMax >= kmTarifa (la tabla es por km entero, así que coincide).
  const tramo =
    tarifas.find((t) => t.kmMax >= kmTarifa) ?? tarifas[tarifas.length - 1];

  return {
    kmConsultado: km,
    kmTarifa: tramo.kmMax,
    costo: tramo.costo,
    fueraDeRango,
  };
}
