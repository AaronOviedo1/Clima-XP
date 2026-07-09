import { Navigation, MapPin } from "lucide-react";
import { auth } from "@/auth";
import { AUTH_HABILITADA, USUARIO_POR_DEFECTO } from "@/lib/auth-flag";
import { datosDelDia, tarjetaDesdeRenta } from "@/lib/dashboard";
import { ordenarRuta, bodegaDesdeEnv } from "@/lib/ruta";
import { linksRuta, type ParadaRuta } from "@/lib/maps";
import { fechaLarga } from "@/lib/fechas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardCard } from "@/components/dashboard-card";

export const dynamic = "force-dynamic";

export default async function RutaPage() {
  const session = AUTH_HABILITADA ? await auth() : null;
  const usuario = session?.user ?? USUARIO_POR_DEFECTO;
  const esAdmin = usuario.rol === "ADMIN";

  const { hoy, entregas } = await datosDelDia({
    esAdmin,
    repartidorId: usuario.id,
  });

  const bodega = bodegaDesdeEnv();
  const ordenadas = ordenarRuta(entregas, bodega);

  const paradas: ParadaRuta[] = ordenadas.map((r) => ({
    direccion: r.direccion,
    lat: r.lat,
    lng: r.lng,
  }));
  const rutas = linksRuta(paradas, bodega ? { direccion: "Bodega", ...bodega } : undefined);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ruta del día</h1>
        <p className="text-sm capitalize text-muted-foreground">{fechaLarga(hoy)}</p>
      </div>

      {ordenadas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay entregas programadas para hoy.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Botón(es) de ruta en Google Maps */}
          <div className="space-y-2">
            {rutas.map((url, i) => (
              <Button asChild key={url} className="h-12 w-full text-base">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <Navigation className="size-5" />
                  {rutas.length > 1
                    ? `Abrir ruta en Maps · parte ${i + 1}/${rutas.length}`
                    : "Abrir ruta en Google Maps"}
                </a>
              </Button>
            ))}
            <p className="text-xs text-muted-foreground">
              {bodega
                ? "Orden sugerido por cercanía desde la bodega."
                : "Orden por captura. Configura BODEGA_LAT/LNG para ordenar por cercanía."}
              {paradas.some((p) => p.lat == null) &&
                " Algunas paradas usan dirección (sin coordenadas)."}
            </p>
          </div>

          {/* Paradas numeradas */}
          <ol className="space-y-2">
            {ordenadas.map((r, i) => (
              <li key={r.id} className="flex items-start gap-2">
                <div className="mt-3 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <DashboardCard r={tarjetaDesdeRenta(r)} mostrarSaldo={esAdmin} />
                </div>
              </li>
            ))}
          </ol>

          <p className="flex items-center justify-center gap-1 pt-2 text-xs text-muted-foreground">
            <MapPin className="size-3.5" /> El aviso masivo “vamos en camino”
            llega en la Fase 7 (WhatsApp).
          </p>
        </>
      )}
    </div>
  );
}
