import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { definirAccion, type LineaResumen } from "../accion";
import { ArgsInvalidos } from "../tool";
import { fechaArg, recortar, textoEquipos } from "../comunes";
import { scopeNegocio, type ContextoCopiloto } from "../contexto";
import { agruparPedido, cargarCatalogo, normalizar } from "./modelos-comun";
import { etiquetaEstado } from "./renta-comun";
import { unidadesDisponibles, unidadesNoDisponibles } from "@/lib/disponibilidad";
import { calcularRenta, type UnidadCalc } from "@/lib/renta-calculo";
import { editarRenta, ubicarCompleto, type EditarRentaInput } from "@/lib/actions/rentas";
import {
  apartaInventario,
  equiposPorModelo,
  ESTADOS_SIN_COBRO,
  totalesDeRenta,
  UNIDADES_BLOQUEADAS,
  type EstadoRentaStr,
} from "@/lib/rentas";
import { diasDeRenta, fechaDesdeInput, fechaLarga, inputDesdeFecha } from "@/lib/fechas";
import { pesos } from "@/lib/dinero";

// "Ponle 250 de domicilio", "muévela al sábado", "cámbiale la dirección",
// "que sean 3 calentones", "agrégale una nota". Corrige una renta YA creada
// con la misma server action que la pantalla de editar (`editarRenta`): mismas
// reglas (cualquier estado se puede corregir; con el equipo en la calle las
// unidades no se tocan; la disponibilidad se revalida excluyendo la propia
// renta; los snapshots de precio se recalculan). Lo que no se edita aquí:
// pagos (proponer_pago), estado (proponer_cancelar_renta /
// proponer_confirmar_cotizacion) y el cliente (se hace en la app).

const MAX_DIAS = 60;

const argsEditar = z.strictObject({
  rentaId: z
    .string()
    .min(1)
    .max(40)
    .describe(
      "Id de la renta a corregir: lo devuelven buscar_rentas, resumen_operativo, saldos_pendientes e historial_cliente, y si la renta se creó desde este chat va en el enlace /rentas/<id> de ACCIONES RECIENTES.",
    ),
  fechaInicio: fechaArg.optional().describe("Nuevo día de entrega (yyyy-mm-dd). Solo si cambia."),
  fechaFin: fechaArg.optional().describe("Nuevo día de recolección (yyyy-mm-dd). Solo si cambia."),
  direccion: z
    .string()
    .trim()
    .min(5)
    .max(200)
    .optional()
    .describe("Nueva dirección de entrega; se vuelve a ubicar y a calcular el domicilio."),
  costoDomicilio: z
    .number()
    .int()
    .min(0)
    .max(100_000)
    .optional()
    .describe(
      "Cargo de domicilio fijado a mano, en pesos ('ponle 250 de domicilio', 'le faltó el domicilio de 250'); sobrescribe la tarifa por km. Tiene que venir textual de la persona.",
    ),
  equipos: z
    .array(
      z.strictObject({
        modelo: z.string().trim().min(2).max(40).describe("Nombre del modelo o el tipo si es inequívoco ('calentón')."),
        cantidad: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(4)
    .optional()
    .describe(
      "El equipo COMPLETO que debe quedar (reemplaza al actual): 'que sean 3 calentones' → [{calentón, 3}]. Solo si el equipo todavía no sale a la calle.",
    ),
  descuento: z
    .strictObject({ monto: z.number().int().positive().max(1_000_000), nota: z.string().trim().min(2).max(120) })
    .nullable()
    .optional()
    .describe("Descuento que debe quedar (monto y motivo); null lo quita."),
  ventanaEntrega: z
    .string()
    .trim()
    .max(60)
    .nullable()
    .optional()
    .describe("Horario de entrega tal cual lo dijo la persona; null lo quita."),
  lugar: z.string().trim().max(40).nullable().optional().describe("Tipo de lugar (Casa, Escuela, Salón…); null lo quita."),
  requiereFactura: z.boolean().optional(),
  agregarNota: z
    .string()
    .trim()
    .min(2)
    .max(300)
    .optional()
    .describe("Texto que se AGREGA a las notas de la renta (no las reemplaza)."),
});

const ejecucionSchema = z.object({
  entrada: z.custom<EditarRentaInput>((v) => typeof v === "object" && v !== null),
});

const rentaEdicionSelect = {
  id: true,
  estado: true,
  updatedAt: true,
  clienteId: true,
  fechaInicio: true,
  fechaFin: true,
  ventanaEntrega: true,
  lugar: true,
  direccion: true,
  codigoAcceso: true,
  lat: true,
  lng: true,
  linkMaps: true,
  distanciaKm: true,
  costoDomicilio: true,
  domicilioSobrescrito: true,
  descuentoMonto: true,
  descuentoNota: true,
  requiereFactura: true,
  notas: true,
  cliente: { select: { nombre: true, telefono: true } },
  unidades: {
    select: {
      precioDia: true,
      unidad: {
        select: {
          id: true,
          codigo: true,
          modelo: { select: { id: true, nombre: true, tipo: true, precioDia: true, precioDia3Mas: true } },
        },
      },
    },
  },
  accesorios: { select: { cargo: true } },
  pagos: { select: { monto: true, tipo: true, pagado: true } },
} satisfies Prisma.RentaSelect;
type RentaEdicion = Prisma.RentaGetPayload<{ select: typeof rentaEdicionSelect }>;

async function cargarRentaEdicion(rentaId: string, ctx: ContextoCopiloto): Promise<RentaEdicion> {
  const r = await prisma.renta.findFirst({ where: { id: rentaId, ...scopeNegocio(ctx) }, select: rentaEdicionSelect });
  if (!r) {
    throw new ArgsInvalidos(
      "No encontré esa renta. Búscala con buscar_rentas, resumen_operativo o historial_cliente y usa el rentaId que devuelvan (o el del enlace /rentas/<id> de ACCIONES RECIENTES).",
    );
  }
  return r;
}

type Elegida = {
  id: string;
  codigo: string;
  modelo: { id: string; nombre: string; tipo: "AEROCOOLER" | "CALENTON"; precioDia: number; precioDia3Mas: number | null };
};

// Crear un Pago no toca Renta.updatedAt, y la tarjeta muestra el saldo después.
function huellaEdicion(r: RentaEdicion): string {
  return `${r.estado}|${r.updatedAt.toISOString()}|${totalesDeRenta(r).pagadoConfirmado}`;
}

export const proponerEditarRenta = definirAccion({
  nombre: "proponer_editar_renta",
  descripcion:
    "PROPONE corregir una renta o cotización YA creada: agregar o cambiar el cargo de domicilio, mover las fechas de entrega/recolección, cambiar la dirección, el equipo (si aún no sale a la calle), el descuento, la ventana de entrega, el lugar, si requiere factura, o agregarle una nota. Manda SOLO los campos que cambian; lo demás se conserva. No la edita: la persona confirma en la tarjeta, donde ve antes → después y el total nuevo. Los pagos van con proponer_pago y el estado con proponer_cancelar_renta / proponer_confirmar_cotizacion.",
  roles: ["ADMIN"],
  args: argsEditar,
  procedencia: (a) => [
    ...(a.costoDomicilio != null ? [a.costoDomicilio] : []),
    ...(a.descuento ? [a.descuento.monto] : []),
    ...(a.equipos ? a.equipos.map((e) => e.cantidad) : []),
  ],
  async preparar(a, ctx) {
    const r = await cargarRentaEdicion(a.rentaId, ctx);
    const campos = [
      a.fechaInicio,
      a.fechaFin,
      a.direccion,
      a.costoDomicilio,
      a.equipos,
      a.descuento,
      a.ventanaEntrega,
      a.lugar,
      a.requiereFactura,
      a.agregarNota,
    ].filter((v) => v !== undefined).length;
    if (campos === 0) {
      throw new ArgsInvalidos(
        "Indica qué cambiar: fechaInicio/fechaFin, direccion, costoDomicilio, equipos, descuento, ventanaEntrega, lugar, requiereFactura o agregarNota.",
      );
    }
    if (a.equipos && UNIDADES_BLOQUEADAS.includes(r.estado as EstadoRentaStr)) {
      throw new ArgsInvalidos(
        `La renta está ${etiquetaEstado(r.estado).toLowerCase()}: con el equipo ya en la calle las unidades no se cambian, solo fechas, datos y cargos.`,
      );
    }

    const cambiados: string[] = [];
    const avisos: string[] = [];

    // Fechas.
    const inicioActual = inputDesdeFecha(r.fechaInicio);
    const finActual = inputDesdeFecha(r.fechaFin);
    const fechaInicio = a.fechaInicio ?? inicioActual;
    const fechaFin = a.fechaFin ?? finActual;
    const inicio = fechaDesdeInput(fechaInicio);
    const fin = fechaDesdeInput(fechaFin);
    if (fin < inicio) throw new ArgsInvalidos("La fecha de recolección no puede ser antes de la entrega.");
    const dias = diasDeRenta(inicio, fin);
    if (dias > MAX_DIAS) throw new ArgsInvalidos(`Son ${dias} días de renta; el máximo desde el chat es ${MAX_DIAS}. Confirma las fechas.`);
    const cambiaFechas = fechaInicio !== inicioActual || fechaFin !== finActual;
    if (cambiaFechas) cambiados.push("fechas");

    // Equipo: el completo que debe quedar. Se conservan las unidades que ya
    // tiene de cada modelo si siguen libres, y se completan con las primeras
    // libres (como el alta).
    let elegidas: Elegida[] = r.unidades.map((u) => ({ id: u.unidad.id, codigo: u.unidad.codigo, modelo: u.unidad.modelo }));
    const idsActuales = elegidas.map((e) => e.id).sort();
    if (a.equipos) {
      const pedido = agruparPedido(a.equipos, await cargarCatalogo());
      const libres = await unidadesDisponibles(inicio, fin, r.id);
      const nuevas: Elegida[] = [];
      for (const { modelo, cantidad } of pedido.values()) {
        const delModelo = libres.filter((u) => u.modeloId === modelo.id);
        if (delModelo.length < cantidad) {
          throw new ArgsInvalidos(
            `Solo hay ${delModelo.length} ${modelo.nombre} libre(s) del ${fechaInicio} al ${fechaFin} (contando las de esta renta) y se piden ${cantidad}. Propón menos unidades, otro modelo u otras fechas.`,
          );
        }
        const yaTiene = new Set(elegidas.filter((e) => e.modelo.id === modelo.id).map((e) => e.id));
        const ordenadas = [...delModelo.filter((u) => yaTiene.has(u.id)), ...delModelo.filter((u) => !yaTiene.has(u.id))];
        for (const u of ordenadas.slice(0, cantidad)) {
          nuevas.push({ id: u.id, codigo: u.codigo, modelo: { id: modelo.id, nombre: modelo.nombre, tipo: modelo.tipo, precioDia: modelo.precioDia, precioDia3Mas: modelo.precioDia3Mas } });
        }
      }
      elegidas = nuevas;
    } else if (cambiaFechas && apartaInventario(r.estado)) {
      const ocupadas = await unidadesNoDisponibles(elegidas.map((e) => e.id), inicio, fin, r.id);
      if (ocupadas.length) {
        throw new ArgsInvalidos(
          `Con las fechas nuevas ya no están libres: ${ocupadas.join(", ")}. Propón otras fechas o cambia también el equipo (equipos).`,
        );
      }
    }
    const idsNuevos = elegidas.map((e) => e.id).sort();
    const cambiaEquipo = idsNuevos.length !== idsActuales.length || idsNuevos.some((id, i) => id !== idsActuales[i]);
    if (cambiaEquipo) cambiados.push("equipo");

    // Dirección y domicilio (misma ubicarCompleto del formulario).
    let direccion = r.direccion;
    let lat = r.lat, lng = r.lng, linkMaps = r.linkMaps, distanciaKm = r.distanciaKm;
    let costoDomicilio = r.costoDomicilio;
    let sobrescrito = r.domicilioSobrescrito;
    let ubicadaComo: string | null = null;
    let notaDomicilio: string | null = null;
    const cambiaDireccion = a.direccion !== undefined && normalizar(a.direccion) !== normalizar(r.direccion);
    if (cambiaDireccion) {
      direccion = a.direccion!;
      cambiados.push("dirección");
      const u = await ubicarCompleto({ ubicacion: "", direccion });
      if (u.fueraDeCobertura) throw new ArgsInvalidos(u.fueraDeCobertura);
      lat = u.coords?.lat ?? null;
      lng = u.coords?.lng ?? null;
      linkMaps = u.linkMaps;
      distanciaKm = u.km;
      ubicadaComo = u.direccionFormateada;
      avisos.push(...u.avisos);
      if (a.costoDomicilio === undefined) {
        if (sobrescrito) {
          avisos.push(
            `El domicilio estaba fijado a mano en ${pesos(r.costoDomicilio)} y se conserva${u.sugerencia ? ` (la tarifa por ${u.km} km sería ${pesos(u.sugerencia.costo)})` : ""}; manda costoDomicilio si debe cambiar.`,
          );
        } else if (u.sugerencia) {
          costoDomicilio = u.sugerencia.costo;
          notaDomicilio = u.sugerencia.fueraDeRango ? `Fuera de tabla — tarifa de ${u.sugerencia.kmTarifa} km` : `Tarifa de ${u.sugerencia.kmTarifa} km`;
        } else {
          avisos.push("No se pudo calcular el domicilio de la dirección nueva; se conserva el anterior.");
        }
      }
    }
    if (a.costoDomicilio !== undefined) {
      costoDomicilio = a.costoDomicilio;
      sobrescrito = true;
      notaDomicilio = "fijado a mano";
    }
    if (costoDomicilio !== r.costoDomicilio) cambiados.push("domicilio");

    // Descuento, ventana, lugar, factura, notas.
    let descuentoMonto = r.descuentoMonto;
    let descuentoNota = r.descuentoNota;
    if (a.descuento === null) {
      descuentoMonto = 0;
      descuentoNota = null;
    } else if (a.descuento) {
      descuentoMonto = a.descuento.monto;
      descuentoNota = a.descuento.nota;
    }
    if (descuentoMonto !== r.descuentoMonto || (descuentoNota ?? "") !== (r.descuentoNota ?? "")) cambiados.push("descuento");
    const ventanaEntrega = a.ventanaEntrega === undefined ? r.ventanaEntrega : a.ventanaEntrega;
    if ((ventanaEntrega ?? "") !== (r.ventanaEntrega ?? "")) cambiados.push("ventana");
    const lugar = a.lugar === undefined ? r.lugar : a.lugar;
    if ((lugar ?? "") !== (r.lugar ?? "")) cambiados.push("lugar");
    const requiereFactura = a.requiereFactura ?? r.requiereFactura;
    if (requiereFactura !== r.requiereFactura) cambiados.push("factura");
    const notas = a.agregarNota ? [r.notas, a.agregarNota].filter(Boolean).join(" · ") : r.notas;
    if (a.agregarNota) cambiados.push("nota");

    if (cambiados.length === 0) {
      throw new ArgsInvalidos("Los valores que mandas son los que ya tiene la renta; no hay nada que cambiar.");
    }

    // Desglose nuevo con la misma función pura que el formulario y el servidor.
    const unidadesCalc: UnidadCalc[] = elegidas.map((e) => ({ id: e.id, tipo: e.modelo.tipo, precioDia: e.modelo.precioDia, precioDia3Mas: e.modelo.precioDia3Mas }));
    const calc = calcularRenta({ unidades: unidadesCalc, dias, costoDomicilio, cargosAccesorios: 0, descuentoMonto });
    if (descuentoMonto > 0 && descuentoMonto >= calc.subtotalEquipos + costoDomicilio) {
      throw new ArgsInvalidos(`El descuento ${pesos(descuentoMonto)} es igual o mayor que el importe (${pesos(calc.subtotalEquipos + costoDomicilio)}); confírmalo.`);
    }
    const antes = totalesDeRenta(r);
    const sinCobro = ESTADOS_SIN_COBRO.includes(r.estado as EstadoRentaStr);
    const saldoDespues = sinCobro ? 0 : calc.total - antes.pagadoConfirmado;

    const entrada: EditarRentaInput = {
      clienteId: r.clienteId,
      fechaInicio,
      fechaFin,
      ventanaEntrega: ventanaEntrega || null,
      lugar: lugar || null,
      direccion,
      codigoAcceso: r.codigoAcceso,
      lat,
      lng,
      linkMaps,
      distanciaKm,
      costoDomicilio,
      domicilioSobrescrito: sobrescrito,
      unidadIds: elegidas.map((e) => e.id),
      descuentoMonto,
      descuentoNota,
      requiereFactura,
      notas,
    };

    // Tarjeta: antes → después solo en lo que cambia.
    const flecha = (antesV: string, despuesV: string) => (antesV === despuesV ? antesV : `${antesV} → ${despuesV}`);
    const equipoAntes = textoEquipos(equiposPorModelo(r.unidades)) || "—";
    const equipoDespues = textoEquipos(equiposPorModelo(elegidas.map((e) => ({ unidad: { modelo: { nombre: e.modelo.nombre, tipo: e.modelo.tipo } } })))) || "—";
    const domicilioTexto = (km: number | null, costo: number, nota: string | null) =>
      `${km != null ? `${km} km · ` : ""}${pesos(costo)}${nota ? ` (${nota})` : ""}`;
    const lineas: LineaResumen[] = [
      { etiqueta: "Cliente", valor: `${r.cliente.nombre}${r.cliente.telefono ? ` · ${r.cliente.telefono}` : ""}` },
      { etiqueta: "Estado", valor: etiquetaEstado(r.estado) },
      { etiqueta: "Entrega", valor: flecha(fechaLarga(r.fechaInicio), fechaLarga(inicio)) },
      { etiqueta: "Recolección", valor: flecha(fechaLarga(r.fechaFin), fechaLarga(fin)) },
      ...(cambiaFechas ? [{ etiqueta: "Días", valor: flecha(String(antes.dias), String(dias)) }] : []),
      { etiqueta: "Equipo", valor: flecha(equipoAntes, equipoDespues) },
      ...(cambiaEquipo
        ? [{ etiqueta: "Códigos", valor: flecha(r.unidades.map((u) => u.unidad.codigo).join(", ") || "—", elegidas.map((e) => e.codigo).join(", ")) }]
        : []),
      { etiqueta: "Dirección", valor: flecha(recortar(r.direccion, 80) || "sin dirección", recortar(direccion, 80) || "sin dirección") },
      ...(ubicadaComo && normalizar(ubicadaComo) !== normalizar(direccion) ? [{ etiqueta: "Ubicada como", valor: recortar(ubicadaComo, 80) }] : []),
      {
        etiqueta: "Domicilio",
        valor: flecha(
          domicilioTexto(r.distanciaKm, r.costoDomicilio, r.domicilioSobrescrito ? "fijado a mano" : null),
          domicilioTexto(distanciaKm, costoDomicilio, notaDomicilio ?? (sobrescrito ? "fijado a mano" : null)),
        ),
      },
      ...(descuentoMonto > 0 || r.descuentoMonto > 0
        ? [{ etiqueta: "Descuento", valor: flecha(r.descuentoMonto > 0 ? `${pesos(r.descuentoMonto)} · ${r.descuentoNota ?? ""}` : "sin descuento", descuentoMonto > 0 ? `${pesos(descuentoMonto)} · ${descuentoNota ?? ""}` : "sin descuento") }]
        : []),
      ...((ventanaEntrega ?? "") !== (r.ventanaEntrega ?? "") ? [{ etiqueta: "Ventana", valor: flecha(r.ventanaEntrega || "—", ventanaEntrega || "—") }] : []),
      ...((lugar ?? "") !== (r.lugar ?? "") ? [{ etiqueta: "Lugar", valor: flecha(r.lugar || "—", lugar || "—") }] : []),
      ...(requiereFactura !== r.requiereFactura ? [{ etiqueta: "Factura", valor: flecha(r.requiereFactura ? "sí" : "no", requiereFactura ? "sí" : "no") }] : []),
      ...(a.agregarNota ? [{ etiqueta: "Nota que se agrega", valor: recortar(a.agregarNota, 100) }] : []),
      { etiqueta: "Total", valor: flecha(pesos(antes.total), pesos(calc.total)) },
      ...(antes.pagadoConfirmado > 0 ? [{ etiqueta: "Pagado", valor: pesos(antes.pagadoConfirmado) }] : []),
      ...(!sinCobro ? [{ etiqueta: "Saldo después", valor: pesos(saldoDespues) }] : []),
      ...avisos.map((v) => ({ etiqueta: "Ojo", valor: recortar(v, 120) })),
    ];

    return {
      resumen: {
        titulo: `Editar renta · ${r.cliente.nombre} · ${cambiados.join(", ")}`,
        lineas,
        confirmacion: { tipo: "simple" },
        enlace: `/rentas/${r.id}`,
      },
      entidadId: r.id,
      ejecucion: { entrada } satisfies z.infer<typeof ejecucionSchema>,
    };
  },
  async huella(a, ctx) {
    const r = await cargarRentaEdicion(a.rentaId, ctx);
    return huellaEdicion(r);
  },
  async ejecutar(a, _datos, _ctx, ejecucionCruda) {
    const e = ejecucionSchema.safeParse(ejecucionCruda);
    if (!e.success) return { ok: false, error: "La propuesta no trae los datos resueltos; vuelve a pedirla." };
    const res = await editarRenta(a.rentaId, e.data.entrada);
    if ("error" in res) return { ok: false, error: res.error };
    return { ok: true, mensaje: "Renta actualizada.", enlace: `/rentas/${a.rentaId}` };
  },
});
