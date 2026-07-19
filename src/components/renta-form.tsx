"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
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
import { linkMapsPunto } from "@/lib/maps";
import { esLinkCortoMaps, esUrl, parseCoordenadas } from "@/lib/coordenadas";
import { ESTADOS_CERRADOS, type EstadoRentaStr } from "@/lib/rentas";
import { calcularRenta } from "@/lib/renta-calculo";
import { diasDeRenta, fechaDesdeInput } from "@/lib/fechas";
import { pesos } from "@/lib/dinero";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ClienteRapidoDialog } from "@/components/cliente-rapido-dialog";
import {
  ClienteCombobox,
  type ClienteOpcion,
} from "@/components/cliente-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const METODOS = [
  { v: "EFECTIVO", l: "Efectivo" },
  { v: "TRANSFERENCIA", l: "Transferencia" },
  { v: "LINK_MERCADO_PAGO", l: "Link Mercado Pago" },
  { v: "OTRO", l: "Otro" },
];

// El calendario trabaja con Date locales; las fechas del formulario son "yyyy-MM-dd".
function fechaLocalDesdeInput(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Valores iniciales cuando el formulario edita una renta existente.
export type RentaEdicion = {
  rentaId: string;
  estado: string;
  // Con el equipo ya entregado (EN_RUTA en adelante) no se cambian unidades.
  bloquearUnidades: boolean;
  iniciales: {
    clienteId: string;
    ventanaEntrega: string;
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
function claveUbicacion(ubicacion: string, direccion: string): string {
  return `${ubicacion.trim()}|${direccion.trim()}`;
}

// ¿Lo pegado trae un link de Maps o coordenadas? Se usa para decidir si vale la
// pena ubicar en el acto o esperar a que salgan del campo.
function pareceUbicacion(texto: string): boolean {
  return esUrl(texto) || esLinkCortoMaps(texto) || parseCoordenadas(texto) != null;
}

// Valor que tendría el campo después de pegar, para poder ubicar en el acto sin
// esperar al re-render (el state todavía no refleja el pegado). Respeta la
// selección: pegar sobre texto seleccionado lo reemplaza, igual que el default.
function valorAlPegar(
  e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
): string | null {
  const pegado = e.clipboardData.getData("text");
  if (!pegado.trim()) return null;
  const el = e.currentTarget;
  const desde = el.selectionStart ?? el.value.length;
  const hasta = el.selectionEnd ?? el.value.length;
  e.preventDefault();
  return el.value.slice(0, desde) + pegado + el.value.slice(hasta);
}

export function RentaForm({
  clientes: clientesIniciales,
  unidadesIniciales,
  fechasIniciales,
  clientePreseleccionado,
  edicion,
  enModal = false,
}: {
  clientes: ClienteOpcion[];
  unidadesIniciales: UnidadOpcion[];
  fechasIniciales: { inicio: string; fin: string };
  clientePreseleccionado?: string;
  edicion?: RentaEdicion;
  enModal?: boolean;
}) {
  const router = useRouter();
  const ini = edicion?.iniciales;
  const [pendingSubmit, startSubmit] = useTransition();
  const [cargandoUnidades, startCargarUnidades] = useTransition();

  const [clientes, setClientes] = useState<ClienteOpcion[]>(clientesIniciales);
  const [clienteId, setClienteId] = useState(
    clientePreseleccionado ?? ini?.clienteId ?? "",
  );
  const [estado, setEstado] = useState<"COTIZADA" | "CONFIRMADA">("CONFIRMADA");
  const [fechaInicio, setFechaInicio] = useState(fechasIniciales.inicio);
  const [fechaFin, setFechaFin] = useState(fechasIniciales.fin);
  const [calAbierto, setCalAbierto] = useState(false);
  // Selección del calendario en curso (independiente de las fechas ya guardadas):
  // se reinicia cada vez que se abre, para que el primer toque siempre empiece
  // una fecha nueva en vez de extender el rango previo (lo que hacía confuso
  // elegir una fecha lejana, como "arrastrar" desde la selección anterior).
  const [rangoCal, setRangoCal] = useState<DateRange | undefined>(undefined);

  const [unidades, setUnidades] = useState<UnidadOpcion[]>(unidadesIniciales);
  const [sel, setSel] = useState<Set<string>>(new Set(ini?.unidadIds ?? []));

  const [direccion, setDireccion] = useState(ini?.direccion ?? "");
  const [ventanaEntrega, setVentanaEntrega] = useState(ini?.ventanaEntrega ?? "");
  // Al editar, refleja si de verdad no se había especificado; al crear, se deja
  // libre para escribir (recién ahí se decide si se especifica o no).
  const [sinVentana, setSinVentana] = useState(edicion ? !ini?.ventanaEntrega : false);
  const [codigoAcceso, setCodigoAcceso] = useState(ini?.codigoAcceso ?? "");

  const [ubicacionTexto, setUbicacionTexto] = useState(ini?.ubicacionTexto ?? "");
  const [lat, setLat] = useState<number | null>(ini?.lat ?? null);
  const [lng, setLng] = useState<number | null>(ini?.lng ?? null);
  const [linkMaps, setLinkMaps] = useState<string | null>(ini?.linkMaps ?? null);
  const [ubicacionMsg, setUbicacionMsg] = useState<string | null>(null);
  const [ubicando, startUbicar] = useTransition();
  // Última combinación dirección + ubicación ya resuelta, para no repetir la
  // llamada a Google Maps en cada blur. Al editar, lo que viene de la BD ya
  // está resuelto.
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

  // Recargar unidades disponibles al cambiar las fechas.
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

  // Flujo de dos toques, siempre desde cero: el primero fija la entrega, el
  // segundo la recolección (tocar la misma fecha dos veces = renta de un día).
  function seleccionarDia(dia: Date) {
    if (!rangoCal?.from || rangoCal.to) {
      setRangoCal({ from: dia, to: undefined });
      return;
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
    setCalAbierto(false);
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

  // Aplica el resultado de ubicarCompleto al estado del formulario y devuelve
  // los valores ya resueltos (setState es asíncrono; quien llama a veces los
  // necesita de inmediato, p. ej. al guardar la renta).
  function aplicarResultadoUbicacion(res: UbicacionCompleta) {
    const nuevoLat = res.coords?.lat ?? null;
    const nuevoLng = res.coords?.lng ?? null;
    const nuevoLinkMaps = res.linkMaps ?? null;
    const nuevaDistancia = res.km != null ? String(res.km) : distanciaKm;

    setLat(nuevoLat);
    setLng(nuevoLng);
    setLinkMaps(nuevoLinkMaps);
    if (res.km != null) setDistanciaKm(nuevaDistancia);

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
    };
  }

  // Coords pegadas o geocoding de la dirección, distancia real desde la bodega
  // (Distance Matrix) y costo de domicilio sugerido.
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
      if (res.km != null) {
        partes.push(`${res.km} km (${res.minutos} min) desde la bodega`);
      }
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
  // se escribió a mano. Así el km y el costo de domicilio ya están en el total
  // antes de guardar.
  function ubicarSiCambio(ubicacion: string, dir: string) {
    if (!ubicacion.trim() && !dir.trim()) return;
    if (claveUbicacion(ubicacion, dir) === ubicadoPara) return;
    ejecutarUbicar(ubicacion, dir);
  }

  function onSalirDeUbicacion() {
    if (ubicando) return;
    ubicarSiCambio(ubicacionTexto, direccion);
  }

  // Si al guardar nadie disparó "Ubicar" todavía (ni manualmente ni en un
  // intento previo), se calcula sola: la dirección ya es obligatoria, así que
  // siempre hay algo con qué geocodificar.
  async function calcularUbicacionSiFalta() {
    if (lat != null || distanciaKm) {
      return { lat, lng, linkMaps, distanciaKm, costoDomicilio, notaDomicilio };
    }
    if (!ubicacionTexto.trim() && !direccion.trim()) {
      return { lat, lng, linkMaps, distanciaKm, costoDomicilio, notaDomicilio };
    }
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

  const unidadesSeleccionadas = useMemo(
    () => unidades.filter((u) => sel.has(u.id)),
    [unidades, sel],
  );
  const dias = diasDeRenta(fechaDesdeInput(fechaInicio), fechaDesdeInput(fechaFin));

  // Los accesorios (mangueras, extensiones, tambos) ya no se cotizan aquí: se
  // saben hasta la entrega y no tienen costo (ver marcarEntregada en renta-acciones.tsx).
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

  // Agrupar unidades disponibles por modelo.
  const porModelo = useMemo(() => {
    const map = new Map<string, UnidadOpcion[]>();
    for (const u of unidades) {
      const arr = map.get(u.modeloNombre) ?? [];
      arr.push(u);
      map.set(u.modeloNombre, arr);
    }
    return [...map.entries()];
  }, [unidades]);

  function onSubmit() {
    setError(null);
    if (!clienteId) return setError("Selecciona un cliente.");
    if (sel.size === 0) return setError("Selecciona al menos una unidad.");
    if (!direccion.trim()) return setError("La dirección es obligatoria.");
    if (descuentoMonto > 0 && !descuentoNota.trim())
      return setError("El descuento requiere una nota con el motivo.");

    startSubmit(async () => {
      // Calcula la distancia y el costo de domicilio sola si nadie tocó "Ubicar".
      const ubic = await calcularUbicacionSiFalta();
      const notaCompleta = [ubic.notaDomicilio, notas].filter(Boolean).join(" · ");

      const base = {
        clienteId,
        fechaInicio,
        fechaFin,
        ventanaEntrega: ventanaEntrega || null,
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
      } else {
        toast.success(edicion ? "Cambios guardados" : "Renta creada");
        if (enModal) {
          // En pop-up: cerrarlo y volver a lo que estaba detrás (el detalle al
          // editar, la lista al dar de alta), ya actualizado.
          router.back();
          router.refresh();
        } else router.push(`/rentas/${res.id}`);
      }
    });
  }

  return (
    <div className={cn("space-y-5", !enModal && "pb-44 xl:pb-28")}>
      {/* Cliente */}
      <section className="space-y-2">
        <Label>Cliente</Label>
        <div className="flex gap-2">
          <ClienteCombobox
            clientes={clientes}
            value={clienteId}
            onChange={setClienteId}
          />
          <ClienteRapidoDialog
            onCreado={(c) => {
              setClientes((prev) =>
                prev.some((x) => x.id === c.id)
                  ? prev
                  : [...prev, c].sort((a, b) =>
                      a.nombre.localeCompare(b.nombre, "es"),
                    ),
              );
              setClienteId(c.id);
            }}
          />
        </div>
      </section>

      {/* Fechas */}
      <section className="space-y-2">
        <Label>Fechas de renta</Label>
        <Popover
          open={calAbierto}
          onOpenChange={(open) => {
            setCalAbierto(open);
            // Reiniciar la selección en curso: cada apertura empieza de cero.
            if (open) setRangoCal(undefined);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-1 size-4 shrink-0 opacity-60" />
              <span className="truncate">
                {format(fechaLocalDesdeInput(fechaInicio), "EEE d MMM", { locale: es })}
                {" → "}
                {format(fechaLocalDesdeInput(fechaFin), "EEE d MMM", { locale: es })}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
              {rangoCal?.from
                ? "Toca la fecha de recolección (o la misma, para un solo día)."
                : "Toca la fecha de entrega."}
            </p>
            <Calendar
              mode="range"
              locale={es}
              numberOfMonths={1}
              defaultMonth={fechaLocalDesdeInput(fechaInicio)}
              selected={
                rangoCal ?? {
                  from: fechaLocalDesdeInput(fechaInicio),
                  to: fechaLocalDesdeInput(fechaFin),
                }
              }
              onSelect={(_rango: DateRange | undefined, dia: Date) => seleccionarDia(dia)}
            />
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">
          Entrega {format(fechaLocalDesdeInput(fechaInicio), "d MMM", { locale: es })} ·
          Recolección {format(fechaLocalDesdeInput(fechaFin), "d MMM", { locale: es })} ·{" "}
          {dias} {dias === 1 ? "día" : "días"} de renta
        </p>
      </section>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="ventana">Ventana de entrega</Label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={sinVentana}
              onCheckedChange={(v) => {
                const marcado = v === true;
                setSinVentana(marcado);
                if (marcado) setVentanaEntrega("");
              }}
            />
            No se especificó
          </label>
        </div>
        <Input
          id="ventana"
          value={ventanaEntrega}
          placeholder="11:00 a 3:00 PM"
          className="h-11"
          disabled={sinVentana}
          onChange={(e) => setVentanaEntrega(e.target.value)}
        />
      </div>

      <Separator />

      {/* Unidades disponibles */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Equipos disponibles</Label>
          <span className="text-xs text-muted-foreground">
            {cargandoUnidades ? "Buscando…" : `${sel.size} seleccionados`}
          </span>
        </div>
        {edicion?.bloquearUnidades && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            {ESTADOS_CERRADOS.includes(edicion.estado as EstadoRentaStr)
              ? "Renta cerrada: las unidades quedan fijas; solo puedes corregir fechas, datos y cargos."
              : "El equipo ya está en la calle: las unidades no se pueden cambiar, solo fechas y datos."}
          </p>
        )}
        {porModelo.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay unidades disponibles para esas fechas.
          </p>
        ) : (
          porModelo.map(([modelo, us]) => (
            <div key={modelo} className="space-y-1.5">
              <p className="text-sm font-medium">
                {modelo}{" "}
                <span className="font-normal text-muted-foreground">
                  · {pesos(us[0].precioDia)}/día · {us.length} libres
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {us.map((u) => {
                  const activo = sel.has(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={edicion?.bloquearUnidades}
                      onClick={() => toggleUnidad(u.id)}
                      className={
                        "rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 " +
                        (activo
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-muted")
                      }
                    >
                      {u.codigo}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
        {calc.aplicaPrecio3Mas && (
          <p className="text-xs text-emerald-600 dark:text-emerald-500">
            Aplica precio de 3+ calentones.
          </p>
        )}
      </section>

      <Separator />

      {/* Dirección + domicilio */}
      <section className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="dir">Dirección</Label>
          <Textarea
            id="dir"
            value={direccion}
            rows={2}
            placeholder="Calle, colonia, referencias… (o pega link/coords de Maps)"
            onChange={(e) => setDireccion(e.target.value)}
            onBlur={onSalirDeUbicacion}
            onPaste={(e) => {
              const v = valorAlPegar(e);
              if (v == null) return;
              setDireccion(v);
              // Solo si lo pegado trae un link/coords: pegar texto suelto de la
              // dirección se resuelve al salir del campo, no en cada pegada.
              if (pareceUbicacion(v)) ubicarSiCambio(ubicacionTexto, v);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ubic">Ubicación (link de Maps o coordenadas)</Label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              id="ubic"
              value={ubicacionTexto}
              placeholder="maps.app.goo.gl/… o 29.10, -111.00"
              className="h-11"
              onChange={(e) => setUbicacionTexto(e.target.value)}
              onBlur={onSalirDeUbicacion}
              onPaste={(e) => {
                const v = valorAlPegar(e);
                if (v == null) return;
                setUbicacionTexto(v);
                ubicarSiCambio(v, direccion);
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={ubicando}
              onClick={onUbicar}
            >
              {ubicando ? "…" : "Ubicar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {ubicando
              ? "Calculando distancia desde la bodega…"
              : "Pega el link de Maps o las coordenadas y los km y el costo de domicilio se calculan solos. Si escribes solo la dirección, se calculan al salir del campo. “Ubicar” recalcula."}
          </p>
          {ubicacionMsg && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {ubicacionMsg}
              {lat != null && lng != null && (
                <a
                  href={linkMapsPunto(direccion, lat, lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  ver
                </a>
              )}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="codigo">Código de acceso</Label>
          <Input
            id="codigo"
            value={codigoAcceso}
            placeholder="código 3112#"
            className="h-11"
            onChange={(e) => setCodigoAcceso(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="km">Distancia (km)</Label>
            <Input
              id="km"
              type="number"
              inputMode="decimal"
              value={distanciaKm}
              className="h-11"
              onChange={(e) => setDistanciaKm(e.target.value)}
            />
          </div>
          <Button type="button" variant="outline" className="h-11" onClick={onSugerirDomicilio}>
            Sugerir costo
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dom">Costo de domicilio</Label>
          <Input
            id="dom"
            type="number"
            inputMode="numeric"
            value={costoDomicilio === 0 ? "" : costoDomicilio}
            placeholder="0"
            className="h-11"
            onChange={(e) => {
              setCostoDomicilio(Math.max(0, parseInt(e.target.value) || 0));
              setDomicilioSobrescrito(true);
            }}
          />
          {notaDomicilio && (
            <p className="text-xs text-muted-foreground">
              {notaDomicilio}
              {domicilioSobrescrito && " · sobrescrito"}
            </p>
          )}
        </div>
      </section>

      <Separator />

      {/* Descuento + factura */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="desc">Descuento</Label>
            <Input
              id="desc"
              type="number"
              inputMode="numeric"
              value={descuentoMonto === 0 ? "" : descuentoMonto}
              placeholder="0"
              className="h-11"
              onChange={(e) => setDescuentoMonto(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descNota">Motivo</Label>
            <Input
              id="descNota"
              value={descuentoNota}
              placeholder="25% renta larga"
              className="h-11"
              onChange={(e) => setDescuentoNota(e.target.value)}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={requiereFactura}
            onCheckedChange={(v) => setRequiereFactura(v === true)}
          />
          Requiere factura
        </label>
      </section>

      {/* Anticipo: solo al crear (los pagos se manejan en el detalle) */}
      {!edicion && (
        <>
          <Separator />
          <section className="space-y-2">
            <Label>Anticipo (opcional)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                inputMode="numeric"
                value={anticipoMonto === 0 ? "" : anticipoMonto}
                placeholder="Monto"
                className="h-11"
                onChange={(e) => setAnticipoMonto(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <Select value={anticipoMetodo} onValueChange={setAnticipoMetodo}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METODOS.map((m) => (
                    <SelectItem key={m.v} value={m.v}>
                      {m.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          value={notas}
          rows={2}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      {/* Estado inicial: solo al crear (en edición el estado se maneja en el detalle) */}
      {!edicion && (
        <section className="space-y-2">
          <Label>Estado inicial</Label>
          <Select value={estado} onValueChange={(v) => setEstado(v as never)}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CONFIRMADA">Confirmada (aparta equipo)</SelectItem>
              <SelectItem value="COTIZADA">Cotizada (sin apartar)</SelectItem>
            </SelectContent>
          </Select>
        </section>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Total: fijo al fondo en pantalla completa (arriba del BottomNav
          mientras esté visible, hasta xl), pegado al borde inferior del pop-up.
          En el pop-up el DialogContent va con pb-0: si conservara su p-4, la
          barra se quedaría flotando 16px arriba del borde (sticky no puede
          salirse del bloque contenedor, que termina donde empieza el padding). */}
      <div
        className={cn(
          "border-t bg-background/95 p-3 backdrop-blur",
          enModal
            ? "sticky bottom-0 -mx-4 px-4"
            : "fixed inset-x-0 z-30 bottom-14 xl:bottom-0",
        )}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 md:max-w-4xl">
          <Card className="flex-1">
            <CardContent className="flex items-center justify-between py-2">
              <div className="text-sm text-muted-foreground">
                {calc.unidades.length} equipos · {dias}d
                {calc.descuentoMonto > 0 && ` · −${pesos(calc.descuentoMonto)}`}
              </div>
              <div className="text-xl font-bold">{pesos(calc.total)}</div>
            </CardContent>
          </Card>
          <Button
            className="h-12 px-6 text-base"
            onClick={onSubmit}
            disabled={pendingSubmit}
          >
            {pendingSubmit ? "Guardando…" : edicion ? "Guardar cambios" : "Crear renta"}
          </Button>
        </div>
      </div>
    </div>
  );
}
