"use client";

import { MapPin, Navigation, Ruler, Truck } from "lucide-react";
import type { RentaFormApi } from "@/hooks/use-renta-form";
import { linkMapsPunto } from "@/lib/maps";
import { pesos } from "@/lib/dinero";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Colapsable, FilaInfo } from "@/components/renta/bloques";
import { CampoDireccion } from "@/components/renta/campo-direccion";

// Sugerencias de tipo de lugar. Antes era un <datalist>, que iOS Safari ignora:
// las 9 opciones eran invisibles justo en el teléfono donde se usa la app.
const LUGARES_FRECUENTES = [
  "Casa",
  "Escuela",
  "Restaurante",
  "Local de eventos",
  "Salón de fiestas",
  "Oficina",
  "Bodega",
  "Iglesia",
  "Taller",
];

/** Paso 3: a dónde va el equipo y cuánto cuesta llevarlo. */
export function PasoDireccion({ form }: { form: RentaFormApi }) {
  const cotizando = form.estado === "COTIZADA" && !form.edicion;

  return (
    <div className="space-y-4">
      <CampoDireccion form={form} opcional={cotizando} />

      {/* Resultado del cálculo: antes era un párrafo corrido de 3–4 líneas. */}
      {(form.ubicacionMsg || form.distanciaKm || form.costoDomicilio > 0) && (
        <Card className="gap-0 overflow-hidden py-0">
          {form.distanciaKm && (
            <FilaInfo
              icono={<Ruler className="size-[19px]" />}
              label="Distancia desde la bodega"
              value={`${form.distanciaKm} km`}
            />
          )}
          <FilaInfo
            icono={<Truck className="size-[19px]" />}
            label="Costo de domicilio"
            value={
              <span>
                {pesos(form.costoDomicilio)}
                {form.notaDomicilio && (
                  <span className="ml-1.5 text-[12px] font-medium text-tenue">
                    {form.notaDomicilio}
                    {form.domicilioSobrescrito && " · a mano"}
                  </span>
                )}
              </span>
            }
            borde={!!form.ubicacionMsg}
          />
          {form.ubicacionMsg && (
            <FilaInfo
              icono={<MapPin className="size-[19px]" />}
              label="Ubicación"
              value={
                <span className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                  {form.ubicacionMsg}
                  {form.lat != null && form.lng != null && (
                    <a
                      href={linkMapsPunto(form.direccion, form.lat, form.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-primary underline"
                    >
                      <Navigation className="size-3.5" /> ver
                    </a>
                  )}
                </span>
              }
              borde={false}
            />
          )}
        </Card>
      )}

      {form.fueraDeCobertura && (
        <p className="rounded-xl bg-chip-rojo px-3.5 py-3 text-[13.5px] font-bold text-chip-rojo-fg">
          {form.fueraDeCobertura}
        </p>
      )}

      {/* Lo que casi nunca se toca, fuera del camino pero a un toque. */}
      <Colapsable
        titulo="Detalles de entrega"
        abierto={!!(form.ventanaEntrega || form.lugar || form.codigoAcceso)}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ventana">Ventana de entrega</Label>
              <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <Checkbox
                  checked={form.sinVentana}
                  onCheckedChange={(v) => {
                    form.setSinVentana(v === true);
                    if (v === true) form.setVentanaEntrega("");
                  }}
                />
                No se especificó
              </label>
            </div>
            <Input
              id="ventana"
              value={form.ventanaEntrega}
              disabled={form.sinVentana}
              placeholder="11:00 a 3:00 PM"
              className="h-11"
              onChange={(e) => form.setVentanaEntrega(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Lugar</Label>
            <div className="flex flex-wrap gap-2">
              {LUGARES_FRECUENTES.map((l) => {
                const activo = form.lugar === l;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => form.setLugar(activo ? "" : l)}
                    className={cn(
                      "h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                      activo
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-linea bg-card active:bg-superficie-hover",
                    )}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
            <Input
              value={form.lugar}
              placeholder="Otro…"
              className="h-11"
              autoComplete="off"
              onChange={(e) => form.setLugar(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="codigo">Código de acceso</Label>
            <Input
              id="codigo"
              value={form.codigoAcceso}
              placeholder="código 3112#"
              className="h-11"
              onChange={(e) => form.setCodigoAcceso(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="km">Distancia (km)</Label>
            <div className="flex gap-2">
              <Input
                id="km"
                type="number"
                inputMode="decimal"
                value={form.distanciaKm}
                className="h-11 flex-1"
                onChange={(e) => form.setDistanciaKm(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0"
                onClick={form.onSugerirDomicilio}
              >
                Sugerir costo
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dom">Costo de domicilio</Label>
            <Input
              id="dom"
              type="number"
              inputMode="numeric"
              value={form.costoDomicilio === 0 ? "" : form.costoDomicilio}
              placeholder="0"
              className="h-11"
              onChange={(e) => {
                form.setCostoDomicilio(Math.max(0, parseInt(e.target.value) || 0));
                form.setDomicilioSobrescrito(true);
              }}
            />
          </div>
        </div>
      </Colapsable>
    </div>
  );
}
