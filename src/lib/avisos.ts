import "server-only";
import { prisma } from "@/lib/prisma";
import { enviarARoles, type ResultadoEnvio } from "@/lib/push";
import { datosDelDia, saldosPendientes } from "@/lib/dashboard";
import { hoyNegocio, inputDesdeFecha, sumarDiasInput } from "@/lib/fechas";
import { pesos } from "@/lib/dinero";

// Los textos de los avisos viven aquí para que las actions y los crons no
// dupliquen el copy. El cuerpo se trunca a ~2 líneas en iOS: nada de párrafos.

const SIN_ENVIOS: ResultadoEnvio = { enviados: 0, fallidos: 0, borrados: 0 };

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Renta confirmada con entrega hoy o mañana → a los repartidores. */
export async function avisarRentaConfirmada(rentaId: string): Promise<ResultadoEnvio> {
  const renta = await prisma.renta.findUnique({
    where: { id: rentaId },
    select: {
      fechaInicio: true,
      ventanaEntrega: true,
      cliente: { select: { nombre: true } },
    },
  });
  if (!renta) return SIN_ENVIOS;

  const hoy = hoyNegocio();
  const dia = inputDesdeFecha(renta.fechaInicio);
  if (dia !== hoy && dia !== sumarDiasInput(hoy, 1)) return SIN_ENVIOS;

  const cuando = dia === hoy ? "hoy" : "mañana";
  const ventana = renta.ventanaEntrega ? ` · ${renta.ventanaEntrega}` : "";

  return enviarARoles(["REPARTIDOR"], {
    titulo: `Nueva entrega ${cuando}`,
    cuerpo: `${renta.cliente.nombre}${ventana}`,
    url: `/rentas/${rentaId}`,
    tag: `renta-${rentaId}`,
    urgente: true,
  });
}

/** El repartidor marcó Entregado o Recogido → al admin (menos a quien la marcó). */
export async function avisarEntregaMarcada(
  rentaId: string,
  estado: "ENTREGADA" | "RECOGIDA",
  actor: { id: string; nombre: string } | null
): Promise<ResultadoEnvio> {
  const renta = await prisma.renta.findUnique({
    where: { id: rentaId },
    select: { cliente: { select: { nombre: true } } },
  });
  if (!renta) return SIN_ENVIOS;

  const quien = actor ? ` — la marcó ${actor.nombre}` : "";

  return enviarARoles(
    ["ADMIN"],
    {
      titulo: estado === "ENTREGADA" ? "Entrega hecha 📦" : "Equipo recogido ✅",
      cuerpo: `${renta.cliente.nombre}${quien}`,
      url: `/rentas/${rentaId}`,
      tag: `renta-${rentaId}-${estado}`,
      urgente: true,
    },
    actor?.id
  );
}

/** Cron de la mañana: qué hay que hacer hoy → a todos. */
export async function avisarResumenDelDia(): Promise<ResultadoEnvio> {
  const { entregas, recolecciones } = await datosDelDia({
    esAdmin: true,
    conSaldos: false,
  });

  // Un día sin trabajo no merece notificación.
  if (entregas.length === 0 && recolecciones.length === 0) return SIN_ENVIOS;

  const partes: string[] = [];
  if (entregas.length > 0) partes.push(plural(entregas.length, "entrega", "entregas"));
  if (recolecciones.length > 0)
    partes.push(plural(recolecciones.length, "recolección", "recolecciones"));

  return enviarARoles(["ADMIN", "REPARTIDOR"], {
    titulo: "Buenos días 🌤️",
    cuerpo: `Hoy: ${partes.join(" y ")}.`,
    url: "/ruta",
    tag: `resumen-${hoyNegocio()}`,
  });
}

/** Cron semanal: lo que falta cobrar → solo al admin. */
export async function avisarSaldosPendientes(): Promise<ResultadoEnvio> {
  const saldos = await saldosPendientes();
  if (saldos.length === 0) return SIN_ENVIOS;

  const total = saldos.reduce((a, s) => a + s.saldo, 0);

  return enviarARoles(["ADMIN"], {
    titulo: "Saldos por cobrar 💰",
    cuerpo: `${plural(saldos.length, "renta debe", "rentas deben")} ${pesos(total)}.`,
    url: "/rentas?saldo=1",
    tag: `saldos-${hoyNegocio()}`,
  });
}
