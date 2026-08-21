import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { definirAccion, type LineaResumen } from "../accion";
import { ArgsInvalidos } from "../tool";
import { fechaArg, recortar } from "../comunes";
import { resolverCliente } from "./clientes-comun";
import { scopeNegocio } from "../contexto";
import { unidadesDisponibles, unidadesNoDisponibles } from "@/lib/disponibilidad";
import { calcularRenta, type UnidadCalc } from "@/lib/renta-calculo";
import { crearRenta, ubicarCompleto, type CrearRentaInput } from "@/lib/actions/rentas";
import { crearClienteRapido } from "@/lib/actions/clientes";
import { diasDeRenta, fechaDesdeInput, fechaLarga, sumarDiasInput } from "@/lib/fechas";
import { pesos } from "@/lib/dinero";

const METODO = ["EFECTIVO", "TRANSFERENCIA", "LINK_MERCADO_PAGO", "OTRO"] as const;
const MAX_DIAS = 60;
const DIAS_ATRAS = 7;
const DIAS_ADELANTE = 365;

const argsRenta = z.strictObject({
  clienteId: z.string().min(1).max(40).optional().describe("Id del cliente (de historial_cliente o buscar_rentas)."),
  busquedaCliente: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .optional()
    .describe("Nombre o teléfono del cliente existente; tiene que dar una sola coincidencia."),
  clienteNuevo: z
    .strictObject({
      nombre: z.string().trim().min(2).max(80),
      telefono: z.string().trim().min(10).max(20).optional(),
    })
    .optional()
    .describe("Solo si la persona dice que es cliente nuevo: se crea al confirmar."),
  estado: z
    .enum(["COTIZADA", "CONFIRMADA"])
    .describe(
      "COTIZADA = cotización (no aparta equipo, puede ir sin dirección): la persona dice 'cotiza', 'pásale precio', 'cuánto sale'. CONFIRMADA = renta apartada (requiere dirección): dice 'hazle la renta', 'apártale', 'confírmala', 'ya quedó' o da un anticipo. Si la frase lo indica, no preguntes cuál.",
    ),
  fechaInicio: fechaArg.describe("Día de entrega (yyyy-mm-dd)."),
  fechaFin: fechaArg.describe(
    "Día de recolección (yyyy-mm-dd). Si la persona dice 'un solo día', 'solo ese día' o 'para el día X', es la MISMA fecha que fechaInicio (no preguntes). Solo pregunta si de verdad no dijo hasta cuándo.",
  ),
  equipos: z
    .array(
      z.strictObject({
        modelo: z.string().trim().min(2).max(40).describe("Nombre del modelo (Eco-Fresco, Turbo-Frío, Fire Sense Café…) o el tipo si es inequívoco ('calentón')."),
        cantidad: z.number().int().min(1).max(20).describe("Cuántas unidades de ese modelo. 'un'/'una' = 1, 'un par' = 2: no preguntes la cantidad si la dijo con palabras."),
      }),
    )
    .min(1)
    .max(4),
  direccion: z.string().trim().min(5).max(200).optional().describe("Dirección de entrega tal cual la dijo la persona (calle, número, colonia). Obligatoria si CONFIRMADA."),
  ventanaEntrega: z.string().trim().max(60).optional().describe("Horario de entrega, p. ej. '11:00 a 1:00 PM'."),
  lugar: z.string().trim().max(40).optional().describe("Tipo de lugar: Casa, Escuela, Salón…"),
  anticipo: z
    .strictObject({ monto: z.number().int().positive().max(1_000_000), metodo: z.enum(METODO) })
    .optional()
    .describe("Solo si la persona lo dijo y la renta es CONFIRMADA."),
  descuento: z
    .strictObject({ monto: z.number().int().positive().max(1_000_000), nota: z.string().trim().min(2).max(120) })
    .optional()
    .describe("Solo si la persona lo dijo; la nota es el motivo."),
  requiereFactura: z.boolean().optional(),
  notas: z.string().trim().max(500).optional(),
});

// Lo que se resuelve al proponer y se ejecuta tal cual al confirmar.
const ejecucionSchema = z.object({
  cliente: z.union([
    z.object({ tipo: z.literal("existente"), clienteId: z.string() }),
    z.object({ tipo: z.literal("nuevo"), nombre: z.string(), telefono: z.string().nullable() }),
  ]),
  entrada: z.custom<Omit<CrearRentaInput, "clienteId">>((v) => typeof v === "object" && v !== null),
});
type Ejecucion = z.infer<typeof ejecucionSchema>;

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const PALABRAS_TIPO: Record<string, "AEROCOOLER" | "CALENTON"> = {
  aerocooler: "AEROCOOLER", aerocoolers: "AEROCOOLER", cooler: "AEROCOOLER", coolers: "AEROCOOLER",
  enfriador: "AEROCOOLER", enfriadores: "AEROCOOLER",
  calenton: "CALENTON", calentones: "CALENTON", calefactor: "CALENTON", calefactores: "CALENTON",
  calentador: "CALENTON", calentadores: "CALENTON",
};

type ModeloCat = { id: string; nombre: string; tipo: "AEROCOOLER" | "CALENTON"; precioDia: number; precioDia3Mas: number | null; unidades: number };

// Nombre de modelo o tipo → un modelo del catálogo, o error que explica qué hay.
function elegirModelo(texto: string, catalogo: ModeloCat[]): ModeloCat {
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
  const parciales = exactos.length ? exactos : catalogo.filter((m) => normalizar(m.nombre).includes(q) || q.includes(normalizar(m.nombre)));
  if (parciales.length === 0) {
    throw new ArgsInvalidos(`No existe el modelo "${texto}". Los modelos rentables son: ${nombres}.`);
  }
  if (parciales.length > 1) {
    throw new ArgsInvalidos(`"${texto}" coincide con varios modelos (${parciales.map((m) => m.nombre).join(", ")}). Pregunta cuál.`);
  }
  const m = parciales[0];
  if (m.unidades === 0) {
    throw new ArgsInvalidos(`${m.nombre} todavía no tiene unidades para rentar. Los modelos rentables son: ${nombres}.`);
  }
  return m;
}

/**
 * "Cotiza 2 Eco-Fresco del sábado al lunes para Juan" / "hazle la renta a un
 * cliente nuevo…". Resuelve cliente, modelos, unidades libres (las primeras N
 * de cada modelo, como el alta), ubicación y domicilio (misma `ubicarCompleto`
 * del formulario) y el desglose (`calcularRenta`); al confirmar crea el cliente
 * nuevo si hace falta y llama `crearRenta`, que revalida todo en transacción.
 */
export const proponerRenta = definirAccion({
  nombre: "proponer_renta",
  descripcion:
    "PROPONE crear una cotización (COTIZADA) o una renta confirmada (CONFIRMADA) para un cliente existente o nuevo, con fechas, cantidad por modelo, dirección y opcionalmente anticipo, descuento, ventana y lugar. No la crea: la persona confirma en la tarjeta, donde ve los equipos asignados, el domicilio calculado y el total. Antes de proponer necesitas: cliente (clienteId de historial_cliente/buscar_rentas, o busquedaCliente, o clienteNuevo con nombre y teléfono), fecha de entrega y de recolección, y qué modelos y cuántos; si la persona no dijo la fecha de recolección o el equipo, pregúntalo (no lo supongas). Para una renta CONFIRMADA también la dirección. No inventes anticipos ni descuentos.",
  roles: ["ADMIN"],
  args: argsRenta,
  procedencia: (a) => [
    ...a.equipos.map((e) => e.cantidad),
    ...(a.anticipo ? [a.anticipo.monto] : []),
    ...(a.descuento ? [a.descuento.monto] : []),
  ],
  async preparar(a, ctx) {
    // 1) Cliente (no se crea aquí).
    const cliente = await resolverCliente(a, ctx);

    // 2) Fechas y reglas por estado.
    const inicio = fechaDesdeInput(a.fechaInicio);
    const fin = fechaDesdeInput(a.fechaFin);
    if (fin < inicio) throw new ArgsInvalidos("La fecha de recolección no puede ser antes de la entrega.");
    if (a.fechaInicio < sumarDiasInput(ctx.hoy, -DIAS_ATRAS) || a.fechaInicio > sumarDiasInput(ctx.hoy, DIAS_ADELANTE)) {
      throw new ArgsInvalidos(`La fecha de entrega ${a.fechaInicio} queda muy lejos de hoy (${ctx.hoy}); confírmala con la persona.`);
    }
    const dias = diasDeRenta(inicio, fin);
    if (dias > MAX_DIAS) throw new ArgsInvalidos(`Son ${dias} días de renta; el máximo desde el chat es ${MAX_DIAS}. Confirma las fechas.`);
    if (a.estado === "CONFIRMADA" && !a.direccion) {
      throw new ArgsInvalidos("Una renta confirmada necesita dirección de entrega; pídesela a la persona o propónla como COTIZADA.");
    }
    if (a.estado === "COTIZADA" && a.anticipo) {
      throw new ArgsInvalidos("Una cotización no lleva anticipo; quítalo o propón la renta como CONFIRMADA.");
    }

    // 3) Modelos y cantidades (mismo modelo repetido se suma).
    const catalogo: ModeloCat[] = (
      await prisma.modeloEquipo.findMany({
        select: { id: true, nombre: true, tipo: true, precioDia: true, precioDia3Mas: true, _count: { select: { unidades: true } } },
      })
    ).map((m) => ({ id: m.id, nombre: m.nombre, tipo: m.tipo, precioDia: m.precioDia, precioDia3Mas: m.precioDia3Mas, unidades: m._count.unidades }));
    const pedido = new Map<string, { modelo: ModeloCat; cantidad: number }>();
    for (const e of a.equipos) {
      const m = elegirModelo(e.modelo, catalogo);
      const prev = pedido.get(m.id);
      pedido.set(m.id, { modelo: m, cantidad: (prev?.cantidad ?? 0) + e.cantidad });
    }

    // 4) Unidades libres en esas fechas: las primeras N de cada modelo (como el alta).
    const libres = await unidadesDisponibles(inicio, fin);
    const elegidas: { id: string; codigo: string; modelo: ModeloCat }[] = [];
    for (const { modelo, cantidad } of pedido.values()) {
      const delModelo = libres.filter((u) => u.modeloId === modelo.id);
      if (delModelo.length < cantidad) {
        throw new ArgsInvalidos(
          `Solo hay ${delModelo.length} ${modelo.nombre} libre(s) del ${a.fechaInicio} al ${a.fechaFin} y se piden ${cantidad}. Propón menos unidades, otro modelo u otras fechas (disponibilidad_equipos da el panorama).`,
        );
      }
      for (const u of delModelo.slice(0, cantidad)) elegidas.push({ id: u.id, codigo: u.codigo, modelo });
    }

    // 5) Ubicación y domicilio (misma función que el formulario; solo con dirección).
    let lat: number | null = null, lng: number | null = null, linkMaps: string | null = null;
    let distanciaKm: number | null = null, costoDomicilio = 0, notaDomicilio: string | null = null;
    let ubicadaComo: string | null = null;
    const avisos: string[] = [];
    if (a.direccion) {
      const u = await ubicarCompleto({ ubicacion: "", direccion: a.direccion });
      if (u.fueraDeCobertura) throw new ArgsInvalidos(u.fueraDeCobertura);
      lat = u.coords?.lat ?? null;
      lng = u.coords?.lng ?? null;
      linkMaps = u.linkMaps;
      distanciaKm = u.km;
      ubicadaComo = u.direccionFormateada;
      if (u.sugerencia) {
        costoDomicilio = u.sugerencia.costo;
        notaDomicilio = u.sugerencia.fueraDeRango
          ? `Fuera de tabla — se usó tarifa de ${u.sugerencia.kmTarifa} km`
          : `Tarifa de ${u.sugerencia.kmTarifa} km`;
      }
      avisos.push(...u.avisos);
    }

    // 6) Desglose: la misma función pura que el formulario y el servidor.
    const unidadesCalc: UnidadCalc[] = elegidas.map((e) => ({ id: e.id, tipo: e.modelo.tipo, precioDia: e.modelo.precioDia, precioDia3Mas: e.modelo.precioDia3Mas }));
    const calc = calcularRenta({ unidades: unidadesCalc, dias, costoDomicilio, cargosAccesorios: 0, descuentoMonto: a.descuento?.monto ?? 0 });
    if (a.descuento && a.descuento.monto >= calc.subtotalEquipos + costoDomicilio) {
      throw new ArgsInvalidos(`El descuento ${pesos(a.descuento.monto)} es igual o mayor que el importe (${pesos(calc.subtotalEquipos + costoDomicilio)}); confírmalo.`);
    }
    if (a.anticipo && a.anticipo.monto > calc.total) {
      throw new ArgsInvalidos(`El anticipo ${pesos(a.anticipo.monto)} supera el total ${pesos(calc.total)}.`);
    }
    const saldo = calc.total - (a.anticipo?.monto ?? 0);

    // 7) Entrada para crearRenta, resuelta; se ejecuta tal cual al confirmar.
    const entrada: Omit<CrearRentaInput, "clienteId"> = {
      estado: a.estado,
      fechaInicio: a.fechaInicio,
      fechaFin: a.fechaFin,
      ventanaEntrega: a.ventanaEntrega || null,
      lugar: a.lugar || null,
      direccion: a.direccion ?? "",
      lat,
      lng,
      linkMaps,
      distanciaKm,
      costoDomicilio,
      domicilioSobrescrito: false,
      unidadIds: elegidas.map((e) => e.id),
      descuentoMonto: a.descuento?.monto ?? 0,
      descuentoNota: a.descuento?.nota ?? null,
      requiereFactura: a.requiereFactura ?? false,
      anticipo: a.anticipo ?? null,
      notas: [notaDomicilio, a.notas].filter(Boolean).join(" · ") || null,
    };
    const ejecucion: Ejecucion = {
      cliente: cliente.tipo === "existente" ? { tipo: "existente", clienteId: cliente.clienteId } : { tipo: "nuevo", nombre: cliente.nombre, telefono: cliente.telefono },
      entrada,
    };

    // Líneas de la tarjeta.
    const porModelo = [...pedido.values()].map(({ modelo, cantidad }) => {
      const idsModelo = new Set(elegidas.filter((e) => e.modelo.id === modelo.id).map((e) => e.id));
      const precio = calc.unidades.find((u) => idsModelo.has(u.id))?.precioEfectivo ?? modelo.precioDia;
      return { etiqueta: `${cantidad} × ${modelo.nombre}`, valor: `${pesos(precio)}/día × ${dias} día(s) = ${pesos(precio * dias * cantidad)}${calc.aplicaPrecio3Mas && modelo.tipo === "CALENTON" ? " (precio 3+)" : ""}` };
    });
    const lineas: LineaResumen[] = [
      { etiqueta: "Tipo", valor: a.estado === "COTIZADA" ? "Cotización (no aparta equipo)" : "Renta confirmada (aparta equipo)" },
      {
        etiqueta: "Cliente",
        valor: cliente.tipo === "existente"
          ? `${cliente.nombre}${cliente.telefono ? ` · ${cliente.telefono}` : ""}`
          : `NUEVO: ${cliente.nombre}${cliente.telefono ? ` · ${cliente.telefono}` : ""} (se crea al confirmar)`,
      },
      { etiqueta: "Entrega", valor: fechaLarga(inicio) },
      { etiqueta: "Recolección", valor: fechaLarga(fin) },
      { etiqueta: "Días", valor: String(dias) },
      ...porModelo,
      { etiqueta: "Códigos", valor: elegidas.map((e) => e.codigo).join(", ") },
      a.direccion
        ? { etiqueta: "Dirección", valor: recortar(a.direccion, 80) }
        : { etiqueta: "Dirección", valor: "sin dirección (cotización)" },
      ...(ubicadaComo && normalizar(ubicadaComo) !== normalizar(a.direccion ?? "") ? [{ etiqueta: "Ubicada como", valor: recortar(ubicadaComo, 80) }] : []),
      { etiqueta: "Domicilio", valor: a.direccion ? `${distanciaKm != null ? `${distanciaKm} km · ` : ""}${pesos(costoDomicilio)}${notaDomicilio ? ` (${notaDomicilio})` : ""}` : pesos(0) },
      ...(a.descuento ? [{ etiqueta: "Descuento", valor: `${pesos(a.descuento.monto)} · ${a.descuento.nota}` }] : []),
      { etiqueta: "Total", valor: pesos(calc.total) },
      ...(a.anticipo ? [{ etiqueta: "Anticipo", valor: `${pesos(a.anticipo.monto)} · ${a.anticipo.metodo}` }, { etiqueta: "Saldo", valor: pesos(saldo) }] : []),
      ...(a.ventanaEntrega ? [{ etiqueta: "Ventana", valor: a.ventanaEntrega }] : []),
      ...(a.lugar ? [{ etiqueta: "Lugar", valor: a.lugar }] : []),
      ...(a.requiereFactura ? [{ etiqueta: "Factura", valor: "sí (IVA aparte en la hoja)" }] : []),
      ...(a.notas ? [{ etiqueta: "Notas", valor: recortar(a.notas, 80) }] : []),
      ...avisos.map((v) => ({ etiqueta: "Ojo", valor: recortar(v, 100) })),
    ];
    return {
      resumen: {
        titulo: `${a.estado === "COTIZADA" ? "Crear cotización" : "Crear renta"} · ${cliente.nombre} · ${pesos(calc.total)}`,
        lineas,
        confirmacion: { tipo: "simple" },
      },
      entidadId: null,
      ejecucion,
    };
  },
  // Que las unidades elegidas sigan libres y el cliente nuevo no se haya
  // registrado mientras tanto (crearRenta revalida igual en transacción; esto
  // solo da un mensaje mejor antes de intentar).
  async huella(a, ctx, ejecucionCruda) {
    const e = ejecucionSchema.safeParse(ejecucionCruda);
    if (!e.success) return "sin-ejecucion";
    const ocupadas = await unidadesNoDisponibles(e.data.entrada.unidadIds, fechaDesdeInput(a.fechaInicio), fechaDesdeInput(a.fechaFin));
    let cli = "ok";
    if (e.data.cliente.tipo === "nuevo" && e.data.cliente.telefono) {
      const dup = await prisma.cliente.findFirst({ where: { telefono: e.data.cliente.telefono, ...scopeNegocio(ctx) }, select: { id: true } });
      cli = dup ? "telefono-ya-registrado" : "ok";
    }
    return `ocupadas:${ocupadas.join(",") || "-"}|cliente:${cli}`;
  },
  async ejecutar(a, _datos, _ctx, ejecucionCruda) {
    const e = ejecucionSchema.safeParse(ejecucionCruda);
    if (!e.success) return { ok: false, error: "La propuesta no trae los datos resueltos; vuelve a pedirla." };
    let clienteId: string;
    if (e.data.cliente.tipo === "existente") {
      clienteId = e.data.cliente.clienteId;
    } else {
      const res = await crearClienteRapido({ nombre: e.data.cliente.nombre, telefono: e.data.cliente.telefono, forzar: false });
      if ("error" in res) return { ok: false, error: `No se pudo crear el cliente: ${res.error}` };
      if ("duplicado" in res) {
        return { ok: false, error: `Ya existe ${res.duplicado.nombre} con ese teléfono; vuelve a proponer con ese cliente.` };
      }
      clienteId = res.cliente.id;
    }
    const res = await crearRenta({ ...e.data.entrada, clienteId });
    if ("error" in res) {
      const aviso = e.data.cliente.tipo === "nuevo" ? " (el cliente nuevo sí quedó creado)" : "";
      return { ok: false, error: `${res.error}${aviso}` };
    }
    return {
      ok: true,
      mensaje: `${a.estado === "COTIZADA" ? "Cotización" : "Renta"} creada.${res.aviso ? ` ${res.aviso}` : ""}`,
      enlace: `/rentas/${res.id}`,
    };
  },
});
