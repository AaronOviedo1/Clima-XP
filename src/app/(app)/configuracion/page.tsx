import { Bell, MessageCircle, Route, Tags, Warehouse } from "lucide-react";
import { datosConfiguracion } from "@/lib/configuracion";
import {
  AgregarTarifaForm,
  BodegaForm,
  PreciosForm,
  TarifasForm,
} from "@/components/configuracion-forms";
import { NotificacionesBoton } from "@/components/push/notificaciones-boton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

function Seccion({
  titulo,
  descripcion,
  icono,
  children,
}: {
  titulo: string;
  descripcion?: string;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px] font-extrabold">
          {icono}
          {titulo}
        </CardTitle>
        {descripcion && <p className="text-xs text-muted-foreground">{descripcion}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function ConfiguracionPage() {
  const { modelos, tarifas, bodega } = await datosConfiguracion();

  return (
    <div className="space-y-4 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em] lg:hidden">
        Configuración
      </h1>

      <Seccion
        titulo="Precios por modelo"
        descripcion="Precio por día y precio con 3 o más unidades (calentones)."
        icono={<Tags className="size-4" />}
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
      </Seccion>

      <Seccion
        titulo="Tarifa de domicilio"
        descripcion="Costo del envío según la distancia en km desde la bodega. Se usa para sugerir el domicilio en cada renta (siempre se puede sobrescribir)."
        icono={<Route className="size-4" />}
      >
        <div className="space-y-4">
          <TarifasForm
            tarifas={tarifas.map((t) => ({ id: t.id, kmMax: t.kmMax, costo: t.costo }))}
          />
          <Separator />
          <AgregarTarifaForm />
        </div>
      </Seccion>

      <Seccion
        titulo="Bodega"
        descripcion="Punto de partida para ordenar la ruta del día y (Fase 4) calcular la distancia de cada domicilio."
        icono={<Warehouse className="size-4" />}
      >
        <BodegaForm
          bodega={bodega ? { coords: bodega.coords, fuente: bodega.fuente } : null}
        />
      </Seccion>

      <Seccion
        titulo="Notificaciones"
        descripcion="Avisos al celular: resumen de las entregas del día (7:00 am), rentas confirmadas, entregas marcadas y saldos por cobrar. Se activan por dispositivo; en iPhone hay que instalar la app en la pantalla de inicio."
        icono={<Bell className="size-4" />}
      >
        <NotificacionesBoton
          clavePublica={process.env.VAPID_PUBLIC_KEY ?? null}
          mostrarSiempre
        />
      </Seccion>

      <Seccion
        titulo="Plantillas de WhatsApp"
        icono={<MessageCircle className="size-4" />}
      >
        <p className="text-sm text-muted-foreground">
          Se configuran en la Fase 7 (WhatsApp Business Cloud API): confirmación de renta, “vamos
          en camino” y recordatorio de recolección. Requieren aprobación de Meta.
        </p>
      </Seccion>
    </div>
  );
}
