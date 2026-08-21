import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  Accion,
  EstadoPropuesta,
  PropuestaCliente,
  ResultadoEjecucion,
  ResumenAccion,
} from "./accion";
import type { ContextoCopiloto } from "./contexto";
import { buscarAccion } from "./registro";
import { ArgsInvalidos } from "./tool";

// Persistencia y decisión de las propuestas (filas de AccionCopiloto).
// Proponer = validar + guardar; decidir = releer la fila (nunca los args del
// cliente), verificar dueño/estado/vigencia/huella, reclamarla de forma
// atómica y ejecutar la server action existente.

export const MINUTOS_VIGENCIA = 10;
const MAX_RESULTADO = 500;

const filaSelect = {
  id: true,
  userId: true,
  tipo: true,
  args: true,
  resumen: true,
  ejecucion: true,
  huella: true,
  estado: true,
  resultado: true,
  expiraEn: true,
} satisfies Prisma.AccionCopilotoSelect;

type Fila = Prisma.AccionCopilotoGetPayload<{ select: typeof filaSelect }>;

function aCliente(f: Fila): PropuestaCliente {
  const resumen = f.resumen as ResumenAccion;
  return {
    id: f.id,
    tipo: f.tipo,
    titulo: resumen.titulo,
    lineas: resumen.lineas,
    confirmacion: resumen.confirmacion,
    ...(resumen.enlace ? { enlace: resumen.enlace } : {}),
    expiraEn: f.expiraEn.toISOString(),
    estado: f.estado as EstadoPropuesta,
    ...(f.resultado ? { resultado: f.resultado } : {}),
  };
}

async function releer(id: string): Promise<Fila> {
  return prisma.accionCopiloto.findUniqueOrThrow({ where: { id }, select: filaSelect });
}

// Si otra petición la reclamó hace un instante, la fila está CONFIRMADA unos
// milisegundos: se espera un poco para devolver el desenlace real.
async function esperarDesenlace(id: string): Promise<Fila> {
  let f = await releer(id);
  for (let i = 0; i < 4 && f.estado === "CONFIRMADA"; i++) {
    await new Promise((r) => setTimeout(r, 250));
    f = await releer(id);
  }
  return f;
}

/**
 * Prepara (precondiciones + resumen) y persiste la propuesta. Lanza
 * ArgsInvalidos / AccionNoPermitida si no procede: nada se guarda. Una
 * propuesta nueva reemplaza a cualquier otra del mismo usuario que siguiera
 * en PROPUESTA (una sola viva por persona).
 */
export async function prepararPropuesta(
  accion: Accion,
  args: unknown,
  ctx: ContextoCopiloto,
): Promise<PropuestaCliente> {
  const limpios = accion.args.parse(args);
  const { resumen, entidadId, ejecucion } = await accion.preparar(limpios, ctx);
  const huella = await accion.huella(limpios, ctx, ejecucion);
  const ahora = new Date();
  const [, fila] = await prisma.$transaction([
    prisma.accionCopiloto.updateMany({
      where: { userId: ctx.userId, estado: "PROPUESTA" },
      data: { estado: "CANCELADA", decididoEn: ahora, resultado: "Reemplazada por una propuesta nueva." },
    }),
    prisma.accionCopiloto.create({
      data: {
        userId: ctx.userId,
        rol: ctx.rol,
        tipo: accion.nombre,
        args: limpios as Prisma.InputJsonValue,
        resumen: resumen as unknown as Prisma.InputJsonValue,
        ejecucion: ejecucion === undefined ? undefined : (ejecucion as Prisma.InputJsonValue),
        entidadId,
        huella,
        expiraEn: new Date(ahora.getTime() + MINUTOS_VIGENCIA * 60_000),
      },
      select: filaSelect,
    }),
  ]);
  return aCliente(fila);
}

// La propuesta viva del usuario, si la hay. Las vencidas se marcan EXPIRADA
// de paso (no hay cron: la expiración se aplica al consultar o al decidir).
export async function propuestaPendiente(userId: string): Promise<PropuestaCliente | null> {
  const ahora = new Date();
  await prisma.accionCopiloto.updateMany({
    where: { userId, estado: "PROPUESTA", expiraEn: { lte: ahora } },
    data: { estado: "EXPIRADA", decididoEn: ahora },
  });
  const f = await prisma.accionCopiloto.findFirst({
    where: { userId, estado: "PROPUESTA" },
    orderBy: { createdAt: "desc" },
    select: filaSelect,
  });
  return f ? aCliente(f) : null;
}

export type Decision = {
  status: 200 | 400 | 404 | 409 | 410;
  propuesta?: PropuestaCliente;
  error?: string;
};

const MENSAJE_DECIDIDA: Partial<Record<EstadoPropuesta, string>> = {
  CONFIRMADA: "La propuesta ya se está ejecutando.",
  EJECUTADA: "La propuesta ya se había ejecutado.",
  FALLIDA: "La propuesta ya se había intentado y falló.",
  CANCELADA: "La propuesta ya estaba cancelada.",
  EXPIRADA: "La propuesta ya había vencido.",
};

/**
 * Confirmar o cancelar. Solo con el id: los args se releen de la fila.
 *  404 no existe / no es del usuario / la acción ya no está disponible para su rol
 *  409 ya decidida, o la entidad cambió desde que se propuso (queda FALLIDA)
 *  410 vencida (queda EXPIRADA)
 *  400 datos de confirmación inválidos
 *  200 decidida ahora: `propuesta.estado` dice en qué terminó (EJECUTADA,
 *      FALLIDA con `error`, o CANCELADA)
 */
export async function decidirPropuesta(
  ctx: ContextoCopiloto,
  id: string,
  decision: "confirmar" | "cancelar",
  datos: unknown,
): Promise<Decision> {
  const f = await prisma.accionCopiloto.findUnique({ where: { id }, select: filaSelect });
  // No se distingue "no existe" de "no es tuya": no hay nada que revelar.
  if (!f || f.userId !== ctx.userId) return { status: 404, error: "Propuesta no encontrada." };

  const accion = buscarAccion(f.tipo, ctx.rol);
  if (!accion) {
    return { status: 404, error: "Esa acción ya no está disponible para este usuario." };
  }

  if (f.estado !== "PROPUESTA") {
    const actual = await esperarDesenlace(id);
    return {
      status: 409,
      propuesta: aCliente(actual),
      error: MENSAJE_DECIDIDA[actual.estado as EstadoPropuesta] ?? "La propuesta ya se había decidido.",
    };
  }

  const ahora = new Date();
  if (f.expiraEn.getTime() <= ahora.getTime()) {
    await prisma.accionCopiloto.updateMany({
      where: { id, estado: "PROPUESTA" },
      data: { estado: "EXPIRADA", decididoEn: ahora },
    });
    return {
      status: 410,
      propuesta: aCliente(await releer(id)),
      error: "La propuesta venció; vuelve a pedirla.",
    };
  }

  if (decision === "cancelar") {
    const r = await prisma.accionCopiloto.updateMany({
      where: { id, estado: "PROPUESTA" },
      data: { estado: "CANCELADA", decididoEn: ahora, resultado: "Cancelada por la persona." },
    });
    if (r.count === 0) {
      return { status: 409, propuesta: aCliente(await esperarDesenlace(id)), error: "La propuesta ya se había decidido." };
    }
    return { status: 200, propuesta: aCliente(await releer(id)) };
  }

  // --- confirmar ---
  const datosOk = accion.datosConfirmacion.safeParse(datos);
  if (!datosOk.success) {
    return {
      status: 400,
      propuesta: aCliente(f),
      error: `Datos de confirmación inválidos: ${datosOk.error.issues[0]?.message ?? "revisa lo seleccionado."}`,
    };
  }

  // Huella: que la entidad siga como cuando se propuso. Si ya no existe o no
  // coincide, la propuesta se invalida (FALLIDA) y hay que volver a pedirla.
  let huellaActual: string | null;
  try {
    huellaActual = await accion.huella(f.args, ctx, f.ejecucion ?? undefined);
  } catch (e) {
    const motivo = e instanceof ArgsInvalidos ? e.message : "No se pudo verificar el estado actual.";
    return fallarAntes(id, ahora, motivo);
  }
  if ((f.huella ?? null) !== (huellaActual ?? null)) {
    return fallarAntes(id, ahora, "Cambió desde que se propuso (alguien la movió en la app). Vuelve a pedirla para ver el estado actual.");
  }

  // Claim atómico: solo una petición pasa de PROPUESTA a CONFIRMADA. Un doble
  // tap o dos pestañas ejecutan una vez.
  const claim = await prisma.accionCopiloto.updateMany({
    where: { id, estado: "PROPUESTA" },
    data: { estado: "CONFIRMADA", decididoEn: ahora },
  });
  if (claim.count === 0) {
    return { status: 409, propuesta: aCliente(await esperarDesenlace(id)), error: "La propuesta ya se había decidido." };
  }

  let resultado: ResultadoEjecucion;
  try {
    resultado = await accion.ejecutar(f.args, datosOk.data, ctx, f.ejecucion ?? undefined);
  } catch (e) {
    console.error(`[copiloto] la acción ${f.tipo} falló al ejecutar:`, e);
    resultado = { ok: false, error: e instanceof Error ? e.message : "Error interno al ejecutar." };
  }
  // Si la ejecución produjo un enlace (p. ej. la renta recién creada), la
  // tarjeta lo muestra: se guarda en el resumen.
  const resumenFinal =
    resultado.ok && resultado.enlace
      ? ({ ...(f.resumen as ResumenAccion), enlace: resultado.enlace } as unknown as Prisma.InputJsonValue)
      : undefined;
  await prisma.accionCopiloto.update({
    where: { id },
    data: {
      estado: resultado.ok ? "EJECUTADA" : "FALLIDA",
      resultado: (resultado.ok ? resultado.mensaje : resultado.error).slice(0, MAX_RESULTADO),
      ...(resumenFinal ? { resumen: resumenFinal } : {}),
    },
  });
  return {
    status: 200,
    propuesta: aCliente(await releer(id)),
    ...(resultado.ok ? {} : { error: resultado.error }),
  };
}

async function fallarAntes(id: string, ahora: Date, motivo: string): Promise<Decision> {
  await prisma.accionCopiloto.updateMany({
    where: { id, estado: "PROPUESTA" },
    data: { estado: "FALLIDA", decididoEn: ahora, resultado: motivo.slice(0, MAX_RESULTADO) },
  });
  return { status: 409, propuesta: aCliente(await esperarDesenlace(id)), error: motivo };
}

// Enlaza la propuesta con la consulta del chat que la generó. Nunca lanza.
export async function vincularConsulta(propuestaId: string, consultaId: string): Promise<void> {
  try {
    await prisma.accionCopiloto.update({ where: { id: propuestaId }, data: { consultaId } });
  } catch (e) {
    console.error("[copiloto] No se pudo enlazar la propuesta con la consulta:", e);
  }
}

export type AccionReciente = {
  tipo: string;
  titulo: string;
  estado: EstadoPropuesta;
  resultado: string | null;
  decididoEn: Date;
  // "/rentas/<id>" de lo que se creó o tocó: es como el modelo sabe a qué renta
  // se refiere "te faltó el domicilio" justo después de crearla desde el chat.
  enlace: string | null;
};

// Lo que el usuario ya ejecutó desde el chat hace poco: va al system prompt
// para que el modelo sepa qué está hecho sin confiar en el historial del
// cliente (y sin volver a proponerlo).
export async function accionesRecientes(userId: string, horas = 2): Promise<AccionReciente[]> {
  const filas = await prisma.accionCopiloto.findMany({
    where: {
      userId,
      estado: { in: ["EJECUTADA", "FALLIDA"] },
      decididoEn: { gte: new Date(Date.now() - horas * 3_600_000) },
    },
    orderBy: { decididoEn: "desc" },
    take: 10,
    select: { tipo: true, resumen: true, estado: true, resultado: true, decididoEn: true },
  });
  return filas.map((f) => ({
    tipo: f.tipo,
    titulo: (f.resumen as ResumenAccion).titulo,
    estado: f.estado as EstadoPropuesta,
    resultado: f.resultado,
    decididoEn: f.decididoEn ?? new Date(0),
    enlace: (f.resumen as ResumenAccion).enlace ?? null,
  }));
}
