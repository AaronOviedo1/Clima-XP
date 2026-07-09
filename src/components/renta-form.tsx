"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ClienteOpcion = { id: string; nombre: string };
type AccesorioOpcion = { id: string; descripcion: string; tipo: string };

const METODOS = [
  { v: "EFECTIVO", l: "Efectivo" },
  { v: "TRANSFERENCIA", l: "Transferencia" },
  { v: "LINK_MERCADO_PAGO", l: "Link Mercado Pago" },
  { v: "OTRO", l: "Otro" },
];

function cargoPorDefecto(tipo: string): number {
  return tipo === "TAMBO_GAS" ? 200 : 0;
}

export function RentaForm({
  clientes,
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

  const [clienteId, setClienteId] = useState(clientePreseleccionado ?? "");
  const [estado, setEstado] = useState<"COTIZADA" | "CONFIRMADA">("CONFIRMADA");
  const [fechaInicio, setFechaInicio] = useState(fechasIniciales.inicio);
  const [fechaFin, setFechaFin] = useState(fechasIniciales.fin);

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

  function toggleAccesorio(a: AccesorioOpcion, on: boolean) {
    setAccCargos((prev) => {
      const next = new Map(prev);
      if (on) next.set(a.id, cargoPorDefecto(a.tipo));
      else next.delete(a.id);
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
  const cargosAccesorios = useMemo(
    () => [...accCargos.values()].reduce((a, b) => a + b, 0),
    [accCargos],
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
        accesorios: [...accCargos.entries()].map(([accesorioId, cargo]) => ({
          accesorioId,
          cargo,
        })),
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
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger className="h-11 w-full">
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
      </section>

      {/* Fechas */}
      <section className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="fi">Entrega</Label>
          <Input
            id="fi"
            type="date"
            value={fechaInicio}
            className="h-11"
            onChange={(e) => {
              setFechaInicio(e.target.value);
              recargarUnidades(e.target.value, fechaFin);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ff">Recolección</Label>
          <Input
            id="ff"
            type="date"
            value={fechaFin}
            className="h-11"
            onChange={(e) => {
              setFechaFin(e.target.value);
              recargarUnidades(fechaInicio, e.target.value);
            }}
          />
        </div>
        <p className="col-span-2 text-xs text-muted-foreground">
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
            value={costoDomicilio}
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
        <section className="space-y-2">
          <Label>Accesorios</Label>
          <div className="space-y-2">
            {accesorios.map((a) => {
              const on = accCargos.has(a.id);
              return (
                <div key={a.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`acc-${a.id}`}
                    checked={on}
                    onCheckedChange={(v) => toggleAccesorio(a, v === true)}
                  />
                  <Label htmlFor={`acc-${a.id}`} className="flex-1 font-normal">
                    {a.descripcion}
                  </Label>
                  {on && (
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={accCargos.get(a.id) ?? 0}
                      className="h-9 w-24"
                      onChange={(e) =>
                        setAccCargos((prev) => {
                          const next = new Map(prev);
                          next.set(a.id, Math.max(0, parseInt(e.target.value) || 0));
                          return next;
                        })
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
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
              value={descuentoMonto}
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
            value={anticipoMonto}
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
