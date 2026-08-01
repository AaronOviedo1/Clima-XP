"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  crearRenta,
  editarRenta,
  sugerirDomicilio,
  ubicarCompleto,
  unidadesParaFechas,
  type UbicacionCompleta,
  type UnidadOpcion,
} from "@/lib/actions/rentas";
import { calcularRenta } from "@/lib/renta-calculo";
import { diasDeRenta, fechaDesdeInput } from "@/lib/fechas";
import { pesos } from "@/lib/dinero";
import type { ClienteOpcion } from "@/components/cliente-combobox";

/**
 * Estado y reglas del alta/edición de renta.
 *
 * Vivía dentro de renta-form.tsx; se sacó aquí para que el alta por pasos
 * (`components/renta/alta-renta.tsx`) y la edición en una sola pantalla
 * (`renta-form.tsx`) compartan exactamente la misma lógica: cálculo en vivo,
 * recarga de unidades al cambiar fechas, ubicación automática con su dedupe y
 * las validaciones. Todo el estado en un solo hook, no repartido por pasos.
 */

// Valores iniciales cuando el formulario edita una renta existente.
export type RentaEdicion = {
  rentaId: string;
  estado: string;
  // Con el equipo ya entregado (EN_RUTA en adelante) no se cambian unidades.
  bloquearUnidades: boolean;
  iniciales: {
    clienteId: string;
    ventanaEntrega: string;
    lugar: string;
    direccion: string;
    codigoAcceso: string;
    ubicacionTexto: string;
    lat: number | null;
    lng: number | null;
    linkMaps: string | null;
    distanciaKm: string;
    costoDomicilio: number;
    domicilioSobrescrito: boolean;
    unidadIds: string[];
    descuentoMonto: number;
    descuentoNota: string;
    requiereFactura: boolean;
    notas: string;
  };
};

// Identifica de forma única lo que se le pidió resolver a Google Maps.
export function claveUbicacion(ubicacion: string, direccion: string): string {
  return `${ubicacion.trim()}|${direccion.trim()}`;
}

export type GrupoModelo = {
  modeloId: string;
  nombre: string;
  precioDia: number;
  disponibles: UnidadOpcion[];
  seleccionadas: UnidadOpcion[];
};

export function useRentaForm({
  clientes: clientesIniciales,
  unidadesIniciales,
  fechasIniciales,
  clientePreseleccionado,
  edicion,
  alTerminar,
}: {
  clientes: ClienteOpcion[];
  unidadesIniciales: UnidadOpcion[];
  fechasIniciales: { inicio: string; fin: string };
  clientePreseleccionado?: string;
  edicion?: RentaEdicion;
  // Qué hacer cuando se guardó bien (navegar al detalle, cerrar el pop-up…).
  alTerminar?: (rentaId: string) => void;
}) {
  const router = useRouter();
  const ini = edicion?.iniciales;
  const [pendingSubmit, startSubmit] = useTransition();
  const [cargandoUnidades, startCargarUnidades] = useTransition();

  const [clientes, setClientes] = useState<ClienteOpcion[]>(clientesIniciales);
  const [clienteId, setClienteId] = useState(clientePreseleccionado ?? ini?.clienteId ?? "");
  const [estado, setEstado] = useState<"COTIZADA" | "CONFIRMADA">("CONFIRMADA");
  const [fechaInicio, setFechaInicio] = useState(fechasIniciales.inicio);
  const [fechaFin, setFechaFin] = useState(fechasIniciales.fin);
  // Selección del calendario en curso (independiente de las fechas ya guardadas):
  // se reinicia al empezar de nuevo, para que el primer toque siempre inicie una
  // fecha en vez de extender el rango previo.
  const [rangoCal, setRangoCal] = useState<DateRange | undefined>(undefined);

  const [unidades, setUnidades] = useState<UnidadOpcion[]>(unidadesIniciales);
  const [sel, setSel] = useState<Set<string>>(new Set(ini?.unidadIds ?? []));

  const [direccion, setDireccion] = useState(ini?.direccion ?? "");
  const [lugar, setLugar] = useState(ini?.lugar ?? "");
  const [ventanaEntrega, setVentanaEntrega] = useState(ini?.ventanaEntrega ?? "");
  const [sinVentana, setSinVentana] = useState(edicion ? !ini?.ventanaEntrega : false);
  const [codigoAcceso, setCodigoAcceso] = useState(ini?.codigoAcceso ?? "");

  const [ubicacionTexto, setUbicacionTexto] = useState(ini?.ubicacionTexto ?? "");
  const [lat, setLat] = useState<number | null>(ini?.lat ?? null);
  const [lng, setLng] = useState<number | null>(ini?.lng ?? null);
  const [linkMaps, setLinkMaps] = useState<string | null>(ini?.linkMaps ?? null);
  const [ubicacionMsg, setUbicacionMsg] = useState<string | null>(null);
  const [ubicando, startUbicar] = useTransition();
  // Última combinación dirección + ubicación ya resuelta, para no repetir la
  // llamada a Google Maps. Al editar, lo que viene de la BD ya está resuelto.
  const [ubicadoPara, setUbicadoPara] = useState<string | null>(
    ini && (ini.lat != null || ini.distanciaKm)
      ? claveUbicacion(ini.ubicacionTexto, ini.direccion)
      : null,
  );

  const [distanciaKm, setDistanciaKm] = useState(ini?.distanciaKm ?? "");
  const [costoDomicilio, setCostoDomicilio] = useState(ini?.costoDomicilio ?? 0);
  const [domicilioSobrescrito, setDomicilioSobrescrito] = useState(
    ini?.domicilioSobrescrito ?? false,
  );
  const [notaDomicilio, setNotaDomicilio] = useState("");

  const [descuentoMonto, setDescuentoMonto] = useState(ini?.descuentoMonto ?? 0);
  const [descuentoNota, setDescuentoNota] = useState(ini?.descuentoNota ?? "");
  const [requiereFactura, setRequiereFactura] = useState(ini?.requiereFactura ?? false);

  const [anticipoMonto, setAnticipoMonto] = useState(0);
  const [anticipoMetodo, setAnticipoMetodo] = useState("EFECTIVO");

  const [notas, setNotas] = useState(ini?.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  // Dirección fuera del área de servicio (solo se renta en Hermosillo): mientras
  // tenga motivo, no se guarda.
  const [fueraDeCobertura, setFueraDeCobertura] = useState<string | null>(null);

  // ---------- Fechas y disponibilidad ----------

  function recargarUnidades(inicio: string, fin: string) {
    if (fechaDesdeInput(fin) < fechaDesdeInput(inicio)) return;
    startCargarUnidades(async () => {
      const nuevas = await unidadesParaFechas(inicio, fin, edicion?.rentaId);
      setUnidades(nuevas);
      // Podar selección a las que siguen disponibles.
      setSel((prev) => {
        const ids = new Set(nuevas.map((u) => u.id));
        return new Set([...prev].filter((id) => ids.has(id)));
      });
    });
  }

  // Flujo de dos toques: el primero fija la entrega, el segundo la recolección
  // (tocar la misma fecha dos veces = renta de un día). Devuelve true cuando el
  // rango quedó completo, para que la UI pueda cerrar el calendario.
  function seleccionarDia(dia: Date): boolean {
    if (!rangoCal?.from || rangoCal.to) {
      setRangoCal({ from: dia, to: undefined });
      return false;
    }
    const inicioEnCurso = rangoCal.from;
    const from = dia < inicioEnCurso ? dia : inicioEnCurso;
    const to = dia < inicioEnCurso ? inicioEnCurso : dia;
    setRangoCal({ from, to });

    const inicio = format(from, "yyyy-MM-dd");
    const fin = format(to, "yyyy-MM-dd");
    setFechaInicio(inicio);
    setFechaFin(fin);
    recargarUnidades(inicio, fin);
    return true;
  }

  function toggleUnidad(id: string) {
    if (edicion?.bloquearUnidades) return;
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---------- Equipos por cantidad ----------

  // Unidades agrupadas por modelo, con las que ya están elegidas. Es lo que
  // necesita el paso de equipos: al dueño no le importa qué código sale, solo
  // cuántos de cada modelo (los códigos se asignan solos, en orden).
  const grupos: GrupoModelo[] = useMemo(() => {
    const map = new Map<string, GrupoModelo>();
    for (const u of unidades) {
      const g = map.get(u.modeloId) ?? {
        modeloId: u.modeloId,
        nombre: u.modeloNombre,
        precioDia: u.precioDia,
        disponibles: [],
        seleccionadas: [],
      };
      g.disponibles.push(u);
      if (sel.has(u.id)) g.seleccionadas.push(u);
      map.set(u.modeloId, g);
    }
    return [...map.values()];
  }, [unidades, sel]);

  // Sube o baja la cantidad de un modelo tomando/soltando unidades libres.
  function ponerCantidad(modeloId: string, cantidad: number) {
    if (edicion?.bloquearUnidades) return;
    const grupo = grupos.find((g) => g.modeloId === modeloId);
    if (!grupo) return;
    const objetivo = Math.max(0, Math.min(cantidad, grupo.disponibles.length));

    setSel((prev) => {
      const next = new Set(prev);
      // Se sueltan las de este modelo y se vuelven a tomar las primeras
      // `objetivo` del catálogo: siempre la misma asignación para la misma
      // cantidad, sin arrastrar huecos de subir y bajar.
      for (const u of grupo.disponibles) next.delete(u.id);
      for (const u of grupo.disponibles.slice(0, objetivo)) next.add(u.id);
      return next;
    });
  }

  // ---------- Ubicación y domicilio ----------

  // Aplica el resultado de ubicarCompleto al estado y devuelve los valores ya
  // resueltos (setState es asíncrono; al guardar se necesitan de inmediato).
  function aplicarResultadoUbicacion(res: UbicacionCompleta) {
    const nuevoLat = res.coords?.lat ?? null;
    const nuevoLng = res.coords?.lng ?? null;
    const nuevoLinkMaps = res.linkMaps ?? null;
    const nuevaDistancia = res.km != null ? String(res.km) : distanciaKm;

    setLat(nuevoLat);
    setLng(nuevoLng);
    setLinkMaps(nuevoLinkMaps);
    if (res.km != null) setDistanciaKm(nuevaDistancia);
    setFueraDeCobertura(res.fueraDeCobertura);

    let nuevoCosto = costoDomicilio;
    let nuevaNota = notaDomicilio;
    if (res.sugerencia) {
      if (domicilioSobrescrito) {
        res.avisos.push(
          `Sugerencia: ${pesos(res.sugerencia.costo)} (no aplicada, costo editado a mano)`,
        );
      } else {
        nuevoCosto = res.sugerencia.costo;
        nuevaNota = res.sugerencia.fueraDeRango
          ? `Fuera de tabla — se usó tarifa de ${res.sugerencia.kmTarifa} km`
          : `Tarifa de ${res.sugerencia.kmTarifa} km`;
        setCostoDomicilio(nuevoCosto);
        setNotaDomicilio(nuevaNota);
      }
    }

    return {
      lat: nuevoLat,
      lng: nuevoLng,
      linkMaps: nuevoLinkMaps,
      distanciaKm: nuevaDistancia,
      costoDomicilio: nuevoCosto,
      notaDomicilio: nuevaNota,
      fueraDeCobertura: res.fueraDeCobertura,
    };
  }

  // Recibe los valores por parámetro (no del state): al pegar hay que ubicar con
  // el texto recién pegado, que todavía no pasó por el re-render.
  function ejecutarUbicar(ubicacion: string, dir: string) {
    setUbicacionMsg(null);
    // Se marca antes de la llamada: si no da resultado, tampoco se reintenta en
    // cada blur (queda el botón "Ubicar" para forzarlo).
    setUbicadoPara(claveUbicacion(ubicacion, dir));
    startUbicar(async () => {
      const res = await ubicarCompleto({ ubicacion, direccion: dir });
      aplicarResultadoUbicacion(res);

      const partes: string[] = [];
      if (res.coords) {
        partes.push(`📍 ${res.coords.lat.toFixed(5)}, ${res.coords.lng.toFixed(5)}`);
      }
      if (res.direccionFormateada) partes.push(res.direccionFormateada);
      if (res.km != null) partes.push(`${res.km} km (${res.minutos} min) desde la bodega`);
      partes.push(...res.avisos);
      setUbicacionMsg(
        partes.join(" · ") ||
          "No se detectaron coordenadas (se guardará el link/texto tal cual).",
      );
    });
  }

  // Botón "Ubicar": recalcula siempre, aunque ya se haya resuelto antes.
  function onUbicar() {
    if (!ubicacionTexto.trim() && !direccion.trim()) {
      setUbicacionMsg("Escribe la dirección o pega un link/coordenadas primero.");
      return;
    }
    ejecutarUbicar(ubicacionTexto, direccion);
  }

  // Se calcula sola: en el acto al pegar un link/coords, o al salir del campo si
  // se escribió a mano.
  function ubicarSiCambio(ubicacion: string, dir: string) {
    if (!ubicacion.trim() && !dir.trim()) return;
    if (claveUbicacion(ubicacion, dir) === ubicadoPara) return;
    ejecutarUbicar(ubicacion, dir);
  }

  function onSalirDeUbicacion() {
    if (ubicando) return;
    ubicarSiCambio(ubicacionTexto, direccion);
  }

  // Resuelve la ubicación que quedó pendiente (se escribió la dirección y se
  // tocó "Siguiente" sin salir del campo, que en el teléfono es lo normal) y
  // devuelve el motivo de cobertura si la dirección quedó fuera. Sin esto, el
  // paso siguiente mostraría el total sin el domicilio.
  async function resolverUbicacionPendiente(): Promise<string | null> {
    const clave = claveUbicacion(ubicacionTexto, direccion);
    if (clave === ubicadoPara) return fueraDeCobertura;
    if (!ubicacionTexto.trim() && !direccion.trim()) return null;

    setUbicadoPara(clave);
    const res = await ubicarCompleto({ ubicacion: ubicacionTexto, direccion });
    const aplicado = aplicarResultadoUbicacion(res);

    const partes: string[] = [];
    if (res.coords) partes.push(`📍 ${res.coords.lat.toFixed(5)}, ${res.coords.lng.toFixed(5)}`);
    if (res.direccionFormateada) partes.push(res.direccionFormateada);
    if (res.km != null) partes.push(`${res.km} km (${res.minutos} min) desde la bodega`);
    partes.push(...res.avisos);
    setUbicacionMsg(partes.join(" · ") || null);

    return aplicado.fueraDeCobertura;
  }

  // Si al guardar nadie disparó "Ubicar" todavía, se calcula sola.
  async function calcularUbicacionSiFalta() {
    const actual = {
      lat,
      lng,
      linkMaps,
      distanciaKm,
      costoDomicilio,
      notaDomicilio,
      fueraDeCobertura,
    };
    if (lat != null || distanciaKm) return actual;
    if (!ubicacionTexto.trim() && !direccion.trim()) return actual;
    const res = await ubicarCompleto({ ubicacion: ubicacionTexto, direccion });
    return aplicarResultadoUbicacion(res);
  }

  async function onSugerirDomicilio() {
    const km = parseFloat(distanciaKm);
    if (!Number.isFinite(km) || km <= 0) return;
    const s = await sugerirDomicilio(km);
    if (s) {
      setCostoDomicilio(s.costo);
      setDomicilioSobrescrito(false);
      setNotaDomicilio(
        s.fueraDeRango
          ? `Fuera de tabla — se usó tarifa de ${s.kmTarifa} km`
          : `Tarifa de ${s.kmTarifa} km`,
      );
    }
  }

  // ---------- Cálculo en vivo ----------

  const unidadesSeleccionadas = useMemo(
    () => unidades.filter((u) => sel.has(u.id)),
    [unidades, sel],
  );
  const dias = diasDeRenta(fechaDesdeInput(fechaInicio), fechaDesdeInput(fechaFin));

  // Los accesorios no se cotizan aquí: se saben hasta la entrega y no tienen
  // costo (ver marcarEntregada en actions/rentas.ts).
  const calc = useMemo(
    () =>
      calcularRenta({
        unidades: unidadesSeleccionadas.map((u) => ({
          id: u.id,
          tipo: u.tipo,
          precioDia: u.precioDia,
          precioDia3Mas: u.precioDia3Mas,
        })),
        dias,
        costoDomicilio,
        cargosAccesorios: 0,
        descuentoMonto,
      }),
    [unidadesSeleccionadas, dias, costoDomicilio, descuentoMonto],
  );

  // ---------- Validación ----------

  // Motivo por el que no se puede guardar todavía, o null si está listo. El
  // alta por pasos lo usa para validar cada paso por separado.
  function faltaCliente(): string | null {
    return clienteId ? null : "Selecciona un cliente.";
  }
  function faltaEquipo(): string | null {
    return sel.size > 0 ? null : "Elige al menos un equipo.";
  }
  function faltaDireccion(): string | null {
    // Una cotización puede ir sin dirección (muchas se dan por teléfono, antes
    // de que el cliente la tenga a la mano); se exige al confirmarla.
    if (estado !== "COTIZADA" && !direccion.trim()) return "La dirección es obligatoria.";
    return fueraDeCobertura;
  }
  function faltaCargos(): string | null {
    if (descuentoMonto > 0 && !descuentoNota.trim())
      return "El descuento requiere una nota con el motivo.";
    return null;
  }

  function guardar() {
    setError(null);
    const problema = faltaCliente() ?? faltaEquipo() ?? faltaDireccion() ?? faltaCargos();
    if (problema) {
      setError(problema);
      return;
    }

    startSubmit(async () => {
      // Calcula la distancia y el costo de domicilio sola si nadie tocó "Ubicar".
      const ubic = await calcularUbicacionSiFalta();
      // Si la dirección se resolvió apenas ahora y cayó fuera de Hermosillo, se
      // corta aquí: la renta no llega a guardarse.
      if (ubic.fueraDeCobertura) {
        setError(ubic.fueraDeCobertura);
        toast.error(ubic.fueraDeCobertura);
        return;
      }
      const notaCompleta = [ubic.notaDomicilio, notas].filter(Boolean).join(" · ");

      const base = {
        clienteId,
        fechaInicio,
        fechaFin,
        ventanaEntrega: ventanaEntrega || null,
        lugar: lugar.trim() || null,
        direccion,
        codigoAcceso: codigoAcceso || null,
        lat: ubic.lat,
        lng: ubic.lng,
        linkMaps: ubic.linkMaps,
        distanciaKm: ubic.distanciaKm ? parseFloat(ubic.distanciaKm) : null,
        costoDomicilio: ubic.costoDomicilio,
        domicilioSobrescrito,
        unidadIds: [...sel],
        descuentoMonto,
        descuentoNota: descuentoNota || null,
        requiereFactura,
        notas: notaCompleta || null,
      };

      const res = edicion
        ? await editarRenta(edicion.rentaId, base)
        : await crearRenta({
            ...base,
            estado,
            anticipo:
              anticipoMonto > 0
                ? { monto: anticipoMonto, metodo: anticipoMetodo as never }
                : null,
          });

      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      // Un aviso no impide guardar (p. ej. cotizar equipo ya apartado).
      if (res.aviso) toast.warning(res.aviso);
      toast.success(
        edicion ? "Cambios guardados" : estado === "COTIZADA" ? "Cotización creada" : "Renta creada",
      );
      if (alTerminar) alTerminar(res.id);
      else router.push(`/rentas/${res.id}`);
    });
  }

  return {
    edicion,
    // cliente
    clientes,
    setClientes,
    clienteId,
    setClienteId,
    // fechas
    fechaInicio,
    fechaFin,
    dias,
    rangoCal,
    setRangoCal,
    seleccionarDia,
    // equipos
    unidades,
    sel,
    grupos,
    toggleUnidad,
    ponerCantidad,
    cargandoUnidades,
    // entrega
    direccion,
    setDireccion,
    lugar,
    setLugar,
    ventanaEntrega,
    setVentanaEntrega,
    sinVentana,
    setSinVentana,
    codigoAcceso,
    setCodigoAcceso,
    // ubicación
    ubicacionTexto,
    setUbicacionTexto,
    lat,
    lng,
    ubicacionMsg,
    ubicando,
    onUbicar,
    ubicarSiCambio,
    onSalirDeUbicacion,
    resolverUbicacionPendiente,
    fueraDeCobertura,
    // domicilio
    distanciaKm,
    setDistanciaKm,
    costoDomicilio,
    setCostoDomicilio,
    domicilioSobrescrito,
    setDomicilioSobrescrito,
    notaDomicilio,
    onSugerirDomicilio,
    // cargos
    descuentoMonto,
    setDescuentoMonto,
    descuentoNota,
    setDescuentoNota,
    requiereFactura,
    setRequiereFactura,
    anticipoMonto,
    setAnticipoMonto,
    anticipoMetodo,
    setAnticipoMetodo,
    notas,
    setNotas,
    estado,
    setEstado,
    // cálculo y guardado
    calc,
    error,
    setError,
    pendingSubmit,
    guardar,
    faltaCliente,
    faltaEquipo,
    faltaDireccion,
    faltaCargos,
  };
}

export type RentaFormApi = ReturnType<typeof useRentaForm>;
