// Cálculo de renta — función pura compartida entre el formulario (vista previa
// en vivo) y el servidor (cálculo autoritativo y snapshot de precios).
//
// Total = Σ(unidades × precioEfectivo × días) + cargoFestivo + costoDomicilio
//         + Σ(cargos de accesorios) − descuento + IVA (si la renta es "+ IVA")
//
// El IVA va sobre todo el precio: equipo, cargo festivo, accesorios y servicio
// a domicilio, ya con el descuento.
//
// Promo calentones: si la renta lleva 3+ calentones Y se activó la promo
// (`promo3Mas`, renta por renta), cada calentón usa precioDia3Mas.
//
// El cargo festivo llega ya calculado (cargoFestivoDe en lib/festivos.ts),
// porque depende de las fechas y no de los días.

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
  cargoFestivo?: number;
  promo3Mas?: boolean;
  conIva?: boolean;
};

export type UnidadConPrecio = UnidadCalc & { precioEfectivo: number };

export type ResultadoCalculo = {
  dias: number;
  unidades: UnidadConPrecio[];
  aplicaPrecio3Mas: boolean;
  puedePromo3Mas: boolean; // lleva 3+ calentones: la UI ofrece el interruptor
  subtotalEquipos: number;
  cargoFestivo: number;
  subtotalAccesorios: number;
  costoDomicilio: number;
  descuentoMonto: number;
  iva: number; // 0 cuando la renta no es "+ IVA"
  total: number;
};

const UMBRAL_CALENTONES = 3;

export const TASA_IVA = 0.16;

// IVA de una renta "+ IVA". La base es el subtotal completo (equipo,
// accesorios y domicilio, menos el descuento). Vive aquí porque lo comparten
// el formulario, el servidor, los totales de las listas y la hoja de
// cotización: si cada uno sacara su 16% por su lado, el saldo y la hoja
// dejarían de coincidir.
export function ivaDeSubtotal(subtotal: number): number {
  return Math.round(Math.max(0, subtotal) * TASA_IVA);
}

export function calcularRenta(e: EntradaCalculo): ResultadoCalculo {
  const dias = Math.max(1, e.dias || 1);
  const numCalentones = e.unidades.filter((u) => u.tipo === "CALENTON").length;
  const puedePromo3Mas = numCalentones >= UMBRAL_CALENTONES;
  const aplicaPrecio3Mas = puedePromo3Mas && !!e.promo3Mas;

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
  const cargoFestivo = Math.max(0, e.cargoFestivo || 0);

  const subtotal = Math.max(
    0,
    subtotalEquipos + cargoFestivo + subtotalAccesorios + costoDomicilio - descuentoMonto,
  );
  const iva = e.conIva ? ivaDeSubtotal(subtotal) : 0;
  const total = subtotal + iva;

  return {
    dias,
    unidades,
    aplicaPrecio3Mas,
    puedePromo3Mas,
    subtotalEquipos,
    cargoFestivo,
    subtotalAccesorios,
    costoDomicilio,
    descuentoMonto,
    iva,
    total,
  };
}

// Saldo pendiente = total − Σ(pagos con pagado=true, netos de reembolsos).
export function saldoPendiente(total: number, pagosConfirmados: number): number {
  return total - pagosConfirmados;
}
