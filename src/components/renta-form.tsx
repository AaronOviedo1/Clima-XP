"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import {
  crearRenta,
  sugerirDomicilio,
  resolverUbicacion,
  unidadesParaFechas,
  type UnidadOpcion,
} from "@/lib/actions/rentas";
import { linkMapsPunto } from "@/lib/maps";
import { calcularRenta } from "@/lib/renta-calculo";
import { diasDeRenta, fechaDesdeInput } from "@/lib/fechas";
import { pesos } from "@/lib/dinero";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ClienteOpcion = { id: string; nombre: string };
type AccesorioOpcion = {
  id: string;
  descripcion: string;
  tipo: string;
  codigo: string | null;
};

// Qué accesorios aplican a cada tipo de equipo.
const TIPO_ACCESORIO_INFO: Record<
  string,
  { titulo: string; equipo: "AEROCOOLER" | "CALENTON" }
> = {
  MANGUERA: { titulo: "Mangueras", equipo: "AEROCOOLER" },
  EXTENSION: { titulo: "Extensiones", equipo: "AEROCOOLER" },
  TAMBO_GAS: { titulo: "Tambos de gas", equipo: "CALENTON" },
};

const METODOS = [
  { v: "EFECTIVO", l: "Efectivo" },
  { v: "TRANSFERENCIA", l: "Transferencia" },
  { v: "LINK_MERCADO_PAGO", l: "Link Mercado Pago" },
  { v: "OTRO", l: "Otro" },
];

function cargoPorDefecto(tipo: string): number {
  return tipo === "TAMBO_GAS" ? 200 : 0;
}

// El calendario trabaja con Date locales; las fechas del formulario son "yyyy-MM-dd".
function fechaLocalDesdeInput(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function RentaForm({
  clientes: clientesIniciales,
  accesorios,
  unidadesIniciales,
  fechasIniciales,
  clientePreseleccionado,
}: {
  clientes: ClienteOpcion[];
  accesorios: AccesorioOpcion[];
  unidadesIniciales: UnidadOpcion[];
  fechasIniciales: { inicio: string; fin: string };
  clientePreseleccionado?: string;
}) {
  const router = useRouter();
  const [pendingSubmit, startSubmit] = useTransition();
  const [cargandoUnidades, startCargarUnidades] = useTransition();

  const [clientes, setClientes] = useState<ClienteOpcion[]>(clientesIniciales);
  const [clienteId, setClienteId] = useState(clientePreseleccionado ?? "");
  const [estado, setEstado] = useState<"COTIZADA" | "CONFIRMADA">("CONFIRMADA");
  const [fechaInicio, setFechaInicio] = useState(fechasIniciales.inicio);
  const [fechaFin, setFechaFin] = useState(fechasIniciales.fin);
  const [calAbierto, setCalAbierto] = useState(false);

  const [unidades, setUnidades] = useState<UnidadOpcion[]>(unidadesIniciales);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const [direccion, setDireccion] = useState("");
  const [ventanaEntrega, setVentanaEntrega] = useState("");
  const [codigoAcceso, setCodigoAcceso] = useState("");

  const [ubicacionTexto, setUbicacionTexto] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [linkMaps, setLinkMaps] = useState<string | null>(null);
  const [ubicacionMsg, setUbicacionMsg] = useState<string | null>(null);
  const [ubicando, startUbicar] = useTransition();

  const [distanciaKm, setDistanciaKm] = useState("");
  const [costoDomicilio, setCostoDomicilio] = useState(0);
  const [domicilioSobrescrito, setDomicilioSobrescrito] = useState(false);
  const [notaDomicilio, setNotaDomicilio] = useState("");

  const [accCargos, setAccCargos] = useState<Map<string, number>>(new Map());

  const [descuentoMonto, setDescuentoMonto] = useState(0);
  const [descuentoNota, setDescuentoNota] = useState("");
  const [requiereFactura, setRequiereFactura] = useState(false);

  const [anticipoMonto, setAnticipoMonto] = useState(0);
  const [anticipoMetodo, setAnticipoMetodo] = useState("EFECTIVO");

  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Recargar unidades disponibles al cambiar las fechas.
  function recargarUnidades(inicio: string, fin: string) {
    if (fechaDesdeInput(fin) < fechaDesdeInput(inicio)) return;
    startCargarUnidades(async () => {
      const nuevas = await unidadesParaFechas(inicio, fin);
      setUnidades(nuevas);
      // Podar selección a las que siguen disponibles.
      setSel((prev) => {
        const ids = new Set(nuevas.map((u) => u.id));
        return new Set([...prev].filter((id) => ids.has(id)));
      });
    });
  }

  function toggleUnidad(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAccesorio(a: AccesorioOpcion) {
    setAccCargos((prev) => {
      const next = new Map(prev);
      if (next.has(a.id)) next.delete(a.id);
      else next.set(a.id, cargoPorDefecto(a.tipo));
      return next;
    });
  }

  function onUbicar() {
    const texto = ubicacionTexto.trim();
    if (!texto) return;
    setUbicacionMsg(null);
    startUbicar(async () => {
      const res = await resolverUbicacion(texto);
      if (res.coords) {
        setLat(res.coords.lat);
        setLng(res.coords.lng);
        setLinkMaps(res.linkMaps ?? null);
        setUbicacionMsg(
          `📍 ${res.coords.lat.toFixed(5)}, ${res.coords.lng.toFixed(5)}`,
        );
      } else {
        setLat(null);
        setLng(null);
        setLinkMaps(res.linkMaps ?? null);
        setUbicacionMsg(
          res.error ??
            "No se detectaron coordenadas (se guardará el link/texto tal cual).",
        );
      }
    });
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
  // Accesorios visibles según el tipo de los equipos seleccionados.
  const tiposEquipoSeleccionados = useMemo(
    () => new Set(unidadesSeleccionadas.map((u) => u.tipo)),
    [unidadesSeleccionadas],
  );

  const gruposAccesorios = useMemo(() => {
    const map = new Map<string, AccesorioOpcion[]>();
    for (const a of accesorios) {
      const info = TIPO_ACCESORIO_INFO[a.tipo];
      if (!info || !tiposEquipoSeleccionados.has(info.equipo)) continue;
      const arr = map.get(a.tipo) ?? [];
      arr.push(a);
      map.set(a.tipo, arr);
    }
    return [...map.entries()];
  }, [accesorios, tiposEquipoSeleccionados]);

  // Solo cuentan los accesorios que aplican a los equipos seleccionados
  // (si se deselecciona el último calentón, sus tambos dejan de cobrarse).
  const accesoriosVisibles = useMemo(
    () =>
      new Set(gruposAccesorios.flatMap(([, items]) => items.map((a) => a.id))),
    [gruposAccesorios],
  );

  const cargosAccesorios = useMemo(
    () =>
      [...accCargos]
        .filter(([id]) => accesoriosVisibles.has(id))
        .reduce((suma, [, cargo]) => suma + cargo, 0),
    [accCargos, accesoriosVisibles],
  );
  const dias = diasDeRenta(fechaDesdeInput(fechaInicio), fechaDesdeInput(fechaFin));

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
        cargosAccesorios,
        descuentoMonto,
      }),
    [unidadesSeleccionadas, dias, costoDomicilio, cargosAccesorios, descuentoMonto],
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

    const notaCompleta = [notaDomicilio, notas].filter(Boolean).join(" · ");

    startSubmit(async () => {
      const res = await crearRenta({
        clienteId,
        estado,
        fechaInicio,
        fechaFin,
        ventanaEntrega: ventanaEntrega || null,
        direccion,
        codigoAcceso: codigoAcceso || null,
        lat,
        lng,
        linkMaps,
        distanciaKm: distanciaKm ? parseFloat(distanciaKm) : null,
        costoDomicilio,
        domicilioSobrescrito,
        unidadIds: [...sel],
        accesorios: [...accCargos.entries()]
          .filter(([accesorioId]) => accesoriosVisibles.has(accesorioId))
          .map(([accesorioId, cargo]) => ({ accesorioId, cargo })),
        descuentoMonto,
        descuentoNota: descuentoNota || null,
        requiereFactura,
        anticipo:
          anticipoMonto > 0
            ? { monto: anticipoMonto, metodo: anticipoMetodo as never }
            : null,
        notas: notaCompleta || null,
      });
      if ("error" in res) setError(res.error);
      else router.push(`/rentas/${res.id}`);
    });
  }

  return (
    <div className="space-y-5 pb-28">
      {/* Cliente */}
      <section className="space-y-2">
        <Label>Cliente</Label>
        <div className="flex gap-2">
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="h-11 w-full min-w-0 flex-1">
              <SelectValue placeholder="Selecciona un cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <Popover open={calAbierto} onOpenChange={setCalAbierto}>
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
            <Calendar
              mode="range"
              locale={es}
              numberOfMonths={1}
              defaultMonth={fechaLocalDesdeInput(fechaInicio)}
              selected={{
                from: fechaLocalDesdeInput(fechaInicio),
                to: fechaLocalDesdeInput(fechaFin),
              }}
              onSelect={(rango: DateRange | undefined) => {
                if (!rango?.from) return;
                const inicio = format(rango.from, "yyyy-MM-dd");
                const fin = format(rango.to ?? rango.from, "yyyy-MM-dd");
                setFechaInicio(inicio);
                setFechaFin(fin);
                recargarUnidades(inicio, fin);
                // Cerrar al completar el rango (dos días distintos).
                if (rango.to && rango.to.getTime() !== rango.from.getTime()) {
                  setCalAbierto(false);
                }
              }}
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
        <Label htmlFor="ventana">Ventana de entrega</Label>
        <Input
          id="ventana"
          value={ventanaEntrega}
          placeholder="11:00 a 3:00 PM"
          className="h-11"
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
                      onClick={() => toggleUnidad(u.id)}
                      className={
                        "rounded-md border px-3 py-2 text-sm font-medium transition-colors " +
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

      {/* Accesorios */}
      {accesorios.length > 0 && (
        <section className="space-y-3">
          <Label>Accesorios</Label>
          {gruposAccesorios.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {sel.size === 0
                ? "Selecciona equipos para ver sus accesorios."
                : "No hay accesorios para los equipos seleccionados."}
            </p>
          ) : (
            gruposAccesorios.map(([tipo, items]) => {
              const seleccionados = items.filter((a) => accCargos.has(a.id));
              const cargoGrupo = seleccionados.length
                ? (accCargos.get(seleccionados[0].id) ?? 0)
                : 0;
              return (
                <div key={tipo} className="space-y-1.5">
                  <p className="text-sm font-medium">
                    {TIPO_ACCESORIO_INFO[tipo].titulo}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {seleccionados.length} de {items.length}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((a) => {
                      const activo = accCargos.has(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleAccesorio(a)}
                          className={
                            "rounded-md border px-3 py-2 text-sm font-medium transition-colors " +
                            (activo
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:bg-muted")
                          }
                        >
                          {a.codigo ?? a.descripcion}
                        </button>
                      );
                    })}
                  </div>
                  {seleccionados.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-sm text-muted-foreground">
                        Cargo c/u
                      </span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={cargoGrupo === 0 ? "" : cargoGrupo}
                        placeholder="0"
                        className="h-9 w-24"
                        onChange={(e) => {
                          const cargo = Math.max(0, parseInt(e.target.value) || 0);
                          setAccCargos((prev) => {
                            const next = new Map(prev);
                            for (const s of seleccionados) next.set(s.id, cargo);
                            return next;
                          });
                        }}
                      />
                      <span className="text-sm text-muted-foreground">
                        = {pesos(cargoGrupo * seleccionados.length)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}

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

      <Separator />

      {/* Anticipo */}
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

      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          value={notas}
          rows={2}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      {/* Estado inicial */}
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Total fijo abajo */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur md:left-60">
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
            {pendingSubmit ? "Guardando…" : "Crear renta"}
          </Button>
        </div>
      </div>
    </div>
  );
}
