// Cálculo de renta — función pura compartida entre el formulario (vista previa
// en vivo) y el servidor (cálculo autoritativo y snapshot de precios).
//
// Total = Σ(unidades × precioEfectivo × días) + costoDomicilio
//         + Σ(cargos de accesorios) − descuento
//
// Regla calentones: si la renta lleva 3+ calentones, cada calentón usa precioDia3Mas.

export type TipoEquipoCalc = "AEROCOOLER" | "CALENTON";

export type UnidadCalc = {
  id: string;
  tipo: TipoEquipoCalc;
  precioDia: number;
  precioDia3Mas: number | null;
};

export type EntradaCalculo = {
  unidades: UnidadCalc[];
  dias: number;
  costoDomicilio: number;
  cargosAccesorios: number;
  descuentoMonto: number;
};

export type UnidadConPrecio = UnidadCalc & { precioEfectivo: number };

export type ResultadoCalculo = {
  dias: number;
  unidades: UnidadConPrecio[];
  aplicaPrecio3Mas: boolean;
  subtotalEquipos: number;
  subtotalAccesorios: number;
  costoDomicilio: number;
  descuentoMonto: number;
  total: number;
};

const UMBRAL_CALENTONES = 3;

export function calcularRenta(e: EntradaCalculo): ResultadoCalculo {
  const dias = Math.max(1, e.dias || 1);
  const numCalentones = e.unidades.filter((u) => u.tipo === "CALENTON").length;
  const aplicaPrecio3Mas = numCalentones >= UMBRAL_CALENTONES;

  const unidades: UnidadConPrecio[] = e.unidades.map((u) => {
    const precioEfectivo =
      u.tipo === "CALENTON" && aplicaPrecio3Mas && u.precioDia3Mas != null
        ? u.precioDia3Mas
        : u.precioDia;
    return { ...u, precioEfectivo };
  });

  const subtotalEquipos = unidades.reduce(
    (acc, u) => acc + u.precioEfectivo * dias,
    0,
  );
  const subtotalAccesorios = Math.max(0, e.cargosAccesorios || 0);
  const costoDomicilio = Math.max(0, e.costoDomicilio || 0);
  const descuentoMonto = Math.max(0, e.descuentoMonto || 0);

  const total = Math.max(
    0,
    subtotalEquipos + subtotalAccesorios + costoDomicilio - descuentoMonto,
  );

  return {
    dias,
    unidades,
    aplicaPrecio3Mas,
    subtotalEquipos,
    subtotalAccesorios,
    costoDomicilio,
    descuentoMonto,
    total,
  };
}

// Saldo pendiente = total − Σ(pagos con pagado=true, netos de reembolsos).
export function saldoPendiente(total: number, pagosConfirmados: number): number {
  return total - pagosConfirmados;
}
