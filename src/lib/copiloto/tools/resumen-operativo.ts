import "server-only";
import { z } from "zod";
import { definirTool } from "@/lib/copiloto/tool";
import { scopeNegocio } from "@/lib/copiloto/contexto";
import { datosDelDia } from "@/lib/dashboard";
import {
  ENTREGA_HECHA,
  RECOLECCION_HECHA,
  equiposPorModelo,
  totalesDeRenta,
  type EstadoRentaStr,
  type RentaTarjeta,
} from "@/lib/rentas";
import { fechaDesdeInput, fechaLarga } from "@/lib/fechas";
import { fechaArg, recortar, textoEquipos } from "@/lib/copiloto/comunes";

// strictObject, no object: una clave que no esté aquí (p. ej. `rol` o `userId`
// "sugeridos" por el modelo) se rechaza en vez de descartarse en silencio.
export const argsResumenOperativo = z.strictObject({
  fecha: fechaArg.optional().describe("Día a consultar (yyyy-mm-dd). Si se omite, hoy."),
});

export type Parada = {
  rentaId: string;
  cliente: string;
  telefono: string | null;
  estado: EstadoRentaStr;
  hecha: boolean; // ya se entregó / ya se recogió
  equipos: string; // "2 × Eco-Fresco · 1 × Turbo-Frío"
  codigos: string[];
  ventana: string | null;
  direccion: string;
  total?: number; // solo ADMIN
  saldo?: number; // solo ADMIN
};

export type ResumenOperativo = {
  fecha: string;
  etiqueta: string; // "jueves 20 de agosto 2026"
  esHoy: boolean;
  entregas: { total: number; pendientes: number; hechas: number; lista: Parada[] };
  recolecciones: { total: number; pendientes: number; hechas: number; lista: Parada[] };
  entregasManana: number; // entregas confirmadas para el día siguiente a `fecha`
  porCobrarDelDia?: number; // solo ADMIN: suma de saldos de las paradas de ese día (no el global)
};

const LARGO_DIRECCION = 80;

function parada(r: RentaTarjeta, hechas: readonly EstadoRentaStr[], conDinero: boolean): Parada {
  const estado = r.estado as EstadoRentaStr;
  const base: Parada = {
    rentaId: r.id,
    cliente: r.cliente.nombre,
    telefono: r.cliente.telefono,
    estado,
    hecha: hechas.includes(estado),
    equipos: textoEquipos(equiposPorModelo(r.unidades)),
    codigos: r.unidades.map((u) => u.unidad.codigo),
    ventana: r.ventanaEntrega,
    direccion: recortar(r.direccion, LARGO_DIRECCION),
  };
  // Al repartidor la clave se le omite, no se manda en 0: "$0" se lee como "no debe nada".
  if (!conDinero) return base;
  const t = totalesDeRenta(r);
  return { ...base, total: t.total, saldo: t.saldo };
}

function bloque(lista: Parada[]) {
  const hechas = lista.filter((p) => p.hecha).length;
  return { total: lista.length, pendientes: lista.length - hechas, hechas, lista };
}

export const resumenOperativo = definirTool({
  nombre: "resumen_operativo",
  descripcion:
    "Entregas y recolecciones de un día (hoy si no se indica fecha): cuántas hay, cuáles ya se hicieron y cuáles faltan, con cliente, equipo, ventana de entrega y dirección; y cuántas entregas hay confirmadas para el día siguiente. Para el administrador incluye total y saldo de cada parada y la suma por cobrar en esas paradas. Úsala para '¿qué hay hoy?', '¿qué entrego mañana?', '¿cuántas recolecciones faltan?'.",
  roles: ["ADMIN", "REPARTIDOR"],
  args: argsResumenOperativo,
  async ejecutar({ fecha }, ctx) {
    const dia = fecha ?? ctx.hoy;
    const conDinero = ctx.rol === "ADMIN";
    const { entregas, recolecciones, manana } = await datosDelDia({
      esAdmin: conDinero,
      conSaldos: false,
      fecha: dia,
      scope: scopeNegocio(ctx),
    });

    const resumen: ResumenOperativo = {
      fecha: dia,
      etiqueta: fechaLarga(fechaDesdeInput(dia)),
      esHoy: dia === ctx.hoy,
      entregas: bloque(entregas.map((r) => parada(r, ENTREGA_HECHA, conDinero))),
      recolecciones: bloque(recolecciones.map((r) => parada(r, RECOLECCION_HECHA, conDinero))),
      entregasManana: manana.length,
    };

    if (conDinero) {
      // Una renta del mismo día (entrega y recolección) sale en los dos bloques:
      // se cuenta una vez.
      const vistas = new Set<string>();
      let porCobrar = 0;
      for (const r of [...entregas, ...recolecciones]) {
        if (vistas.has(r.id)) continue;
        vistas.add(r.id);
        porCobrar += Math.max(0, totalesDeRenta(r).saldo);
      }
      resumen.porCobrarDelDia = porCobrar;
    }
    return resumen;
  },
});
