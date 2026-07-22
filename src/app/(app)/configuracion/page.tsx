import { ChevronDown, MapPin, MessageCircle } from "lucide-react";
import { datosConfiguracion } from "@/lib/configuracion";
import { pesos } from "@/lib/dinero";
import {
  AgregarTarifaForm,
  BodegaForm,
  PreciosForm,
  TarifasForm,
} from "@/components/configuracion-forms";
import { NotificacionesBoton } from "@/components/push/notificaciones-boton";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = { AEROCOOLER: "Aerocooler", CALENTON: "Calentón" };

// Rótulo de sección en mayúsculas gris (como el diseño).
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 mb-2.5 px-1 text-[12.5px] font-extrabold tracking-wide text-muted-foreground uppercase">
      {children}
    </div>
  );
}

// Tarjeta con display visible + formulario que se expande al tocar "Editar".
function TarjetaEditable({
  resumen,
  children,
}: {
  resumen: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <details className="group">
        <summary className="cursor-pointer list-none">
          {resumen}
          <div className="flex items-center justify-center gap-1 border-t py-2 text-[12.5px] font-semibold text-muted-foreground">
            Editar
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="border-t p-4">{children}</div>
      </details>
    </Card>
  );
}

export default async function ConfiguracionPage() {
  const { modelos, tarifas, bodega } = await datosConfiguracion();

  const costos = tarifas.map((t) => t.costo);
  const tarifaMin = costos.length ? Math.min(...costos) : null;
  const tarifaMax = costos.length ? Math.max(...costos) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em] lg:hidden">
        Configuración
      </h1>

      {/* Precios por modelo */}
      <Rotulo>Precios por modelo</Rotulo>
      <TarjetaEditable
        resumen={
          <div>
            {modelos.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 border-b px-4 py-3.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold">{m.nombre}</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">
                    {TIPO_LABEL[m.tipo] ?? m.tipo}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5">
                  <span className="text-[15px] font-extrabold tabular-nums">{pesos(m.precioDia)}</span>
                  <span className="text-[11.5px] font-semibold text-muted-foreground">/día</span>
                </div>
              </div>
            ))}
          </div>
        }
      >
        <PreciosForm
          modelos={modelos.map((m) => ({
            id: m.id,
            nombre: m.nombre,
            tipo: m.tipo,
            precioDia: m.precioDia,
            precioDia3Mas: m.precioDia3Mas,
            numUnidades: m._count.unidades,
          }))}
        />
      </TarjetaEditable>

      {/* Tarifa de domicilio */}
      <Rotulo>Tarifa de domicilio</Rotulo>
      <TarjetaEditable
        resumen={
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14.5px] font-semibold">Por kilómetro</span>
              <span className="text-[14.5px] font-extrabold tabular-nums">
                {tarifaMin != null ? `${pesos(tarifaMin)} – ${pesos(tarifaMax!)}` : "Sin tarifas"}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Calculado automáticamente desde la bodega según distancia.
            </p>
          </div>
        }
      >
        <div className="space-y-4">
          <TarifasForm
            tarifas={tarifas.map((t) => ({ id: t.id, kmMax: t.kmMax, costo: t.costo }))}
          />
          <Separator />
          <AgregarTarifaForm />
        </div>
      </TarjetaEditable>

      {/* Bodega */}
      <Rotulo>Bodega</Rotulo>
      <TarjetaEditable
        resumen={
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-chip-azul text-chip-azul-fg">
              <MapPin className="size-[19px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-semibold">Hermosillo, Sonora</div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground tabular-nums">
                {bodega
                  ? `${bodega.coords.lat.toFixed(4)}, ${bodega.coords.lng.toFixed(4)}`
                  : "Sin capturar"}
              </div>
            </div>
          </div>
        }
      >
        <BodegaForm
          bodega={bodega ? { coords: bodega.coords, fuente: bodega.fuente } : null}
        />
      </TarjetaEditable>

      {/* Notificaciones */}
      <Rotulo>Notificaciones</Rotulo>
      <Card className="gap-0 py-0">
        <div className="space-y-3 px-4 py-4">
          <div className="text-[14.5px] font-semibold">Avisos push</div>
          <NotificacionesBoton
            clavePublica={process.env.VAPID_PUBLIC_KEY ?? null}
            mostrarSiempre
          />
        </div>
      </Card>

      {/* Plantillas de WhatsApp (Fase 7) */}
      <Rotulo>Plantillas de WhatsApp</Rotulo>
      <Card className="gap-0 py-0">
        <div className="flex items-start gap-3 px-4 py-3.5">
          <MessageCircle className="mt-0.5 size-[19px] shrink-0 text-muted-foreground" />
          <p className="text-[13px] text-muted-foreground">
            Se configuran en la Fase 7 (WhatsApp Business Cloud API): confirmación de renta, “vamos
            en camino” y recordatorio de recolección. Requieren aprobación de Meta.
          </p>
        </div>
      </Card>

      <div className="h-2" />
    </div>
  );
}
