import Link from "next/link";
import { Navigation, MapPin, Truck, PackageOpen } from "lucide-react";
import { auth } from "@/auth";
import { AUTH_HABILITADA, USUARIO_POR_DEFECTO } from "@/lib/auth-flag";
import { datosDelDia, tarjetaDesdeRenta } from "@/lib/dashboard";
import { ordenarRuta } from "@/lib/ruta";
import { obtenerBodega } from "@/lib/configuracion";
import { linksRuta, embedRutaMaps, type ParadaRuta } from "@/lib/maps";
import { fechaLarga, fechaValida, hoyNegocio } from "@/lib/fechas";
import type { RentaTarjeta } from "@/lib/rentas";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardCard } from "@/components/dashboard-card";
import { RutaFechaSelector } from "@/components/ruta-fecha-selector";

export const dynamic = "force-dynamic";

export default async function RutaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { fecha: fechaParam } = await searchParams;
  const fecha = fechaValida(fechaParam);
  const hoyStr = hoyNegocio();
  const esHoy = fecha === hoyStr;

  const session = AUTH_HABILITADA ? await auth() : null;
  const usuario = session?.user ?? USUARIO_POR_DEFECTO;
  const esAdmin = usuario.rol === "ADMIN";

  const [{ hoy, entregas, recolecciones }, bodegaInfo] = await Promise.all([
    datosDelDia({ esAdmin, conSaldos: false, fecha }),
    obtenerBodega(),
  ]);

  const bodega = bodegaInfo?.coords ?? null;

  // El día se hace de un viaje: se sale a dejar equipo y a recogerlo, así que
  // las recolecciones son paradas de la misma ruta y entran al mismo orden por
  // cercanía. Una renta de un solo día aparece dos veces (se deja y se recoge
  // ese día): por eso la key de la lista lleva también el contexto.
  type Parada = {
    renta: RentaTarjeta;
    contexto: "entrega" | "recoleccion";
    lat: number | null;
    lng: number | null;
  };
  const delDia: Parada[] = [
    ...entregas.map((renta) => ({
      renta,
      contexto: "entrega" as const,
      lat: renta.lat,
      lng: renta.lng,
    })),
    ...recolecciones.map((renta) => ({
      renta,
      contexto: "recoleccion" as const,
      lat: renta.lat,
      lng: renta.lng,
    })),
  ];
  const ordenadas = ordenarRuta(delDia, bodega);

  const totalEntregas = ordenadas.filter((p) => p.contexto === "entrega").length;
  const totalRecolecciones = ordenadas.length - totalEntregas;

  const paradas: ParadaRuta[] = ordenadas.map((p) => ({
    direccion: p.renta.direccion,
    lat: p.lat,
    lng: p.lng,
  }));
  const origen = bodega ? { direccion: "Bodega", ...bodega } : undefined;
  const rutas = linksRuta(paradas, origen);
  const embedUrl = embedRutaMaps(paradas, origen);

  const conCoords = paradas.filter((p) => p.lat != null).length;

  return (
    <div className="space-y-4">
      {/* Header solo móvil (en desktop lo cubre el TopBar). */}
      <div className="lg:hidden">
        <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em]">
          {esHoy ? "Ruta del día" : "Armar ruta"}
        </h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {fechaLarga(hoy)}
        </p>
      </div>

      <RutaFechaSelector fecha={fecha} hoy={hoyStr} />
      {!esHoy && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Viendo un día distinto a hoy: las acciones de un tap se desactivan
            para no marcar entregas ni recolecciones antes de tiempo.
          </p>
          <Link href="/ruta" className="shrink-0 text-xs text-primary underline underline-offset-2">
            Volver a hoy
          </Link>
        </div>
      )}

      {ordenadas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay entregas ni recolecciones programadas para ese día.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Botón(es) de ruta en Google Maps */}
          <div className="space-y-2">
            {rutas.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="brand-gradient flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold text-white shadow-[0_12px_26px_-12px_rgba(56,113,193,.9)] transition hover:brightness-105"
              >
                <Navigation className="size-5" />
                {rutas.length > 1
                  ? `Abrir ruta en Maps · parte ${i + 1}/${rutas.length}`
                  : "Abrir ruta en Google Maps"}
              </a>
            ))}
            <p className="text-xs text-muted-foreground">
              {bodega
                ? "Orden sugerido por cercanía desde la bodega."
                : "Orden por captura. Configura BODEGA_LAT/LNG para ordenar por cercanía."}
              {paradas.some((p) => p.lat == null) &&
                " Algunas paradas usan dirección (sin coordenadas)."}
            </p>
          </div>

          {/* Paradas numeradas (el número vive dentro de la tarjeta); el chip
              dice si en esa parada se deja o se recoge equipo. */}
          <ol className="space-y-3">
            {ordenadas.map((p, i) => (
              <li key={`${p.contexto}-${p.renta.id}`} className="space-y-1.5">
                {p.contexto === "entrega" ? (
                  <span className="ml-1 inline-flex items-center gap-1.5 rounded-md bg-chip-azul px-2.5 py-1 text-xs font-bold text-chip-azul-fg">
                    <Truck className="size-3.5" /> Entrega
                  </span>
                ) : (
                  <span className="ml-1 inline-flex items-center gap-1.5 rounded-md bg-chip-ambar px-2.5 py-1 text-xs font-bold text-chip-ambar-fg">
                    <PackageOpen className="size-3.5" /> Recolección
                  </span>
                )}
                <DashboardCard
                  r={tarjetaDesdeRenta(p.renta, { conDinero: esAdmin })}
                  mostrarSaldo={esAdmin}
                  contexto={p.contexto}
                  soloLectura={!esHoy}
                  numero={i + 1}
                />
              </li>
            ))}
          </ol>

          {/* Mapa de la ruta, a todo el ancho, debajo de las paradas. */}
          <Card className="gap-0 overflow-hidden py-0">
            <div className="relative h-80 lg:h-[460px]">
              {embedUrl ? (
                <iframe
                  title="Mapa de la ruta"
                  src={embedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0 size-full border-0"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-[linear-gradient(135deg,#dce9f7,#eaf3fb)] dark:bg-[linear-gradient(135deg,#16283f,#101c2c)]">
                  <Navigation className="size-10 text-primary/40" />
                </div>
              )}
              <div className="pointer-events-none absolute top-3.5 left-3.5 flex items-center gap-2 rounded-[10px] bg-card/90 px-3 py-2 text-xs font-bold text-card-foreground shadow">
                <span className="size-2.5 rounded-full bg-[#152b47] dark:bg-primary" />
                Bodega
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-linea p-4 text-[13px]">
              <span className="font-extrabold">Resumen de la ruta</span>
              <span className="text-muted-foreground">
                Paradas{" "}
                <b className="ml-1 text-foreground">{ordenadas.length}</b>
              </span>
              <span className="text-muted-foreground">
                Entregas{" "}
                <b className="ml-1 text-foreground">{totalEntregas}</b>
              </span>
              <span className="text-muted-foreground">
                Recolecciones{" "}
                <b className="ml-1 text-foreground">{totalRecolecciones}</b>
              </span>
              <span className="text-muted-foreground">
                Con coordenadas{" "}
                <b className="ml-1 text-foreground">
                  {conCoords}/{paradas.length}
                </b>
              </span>
              <span className="text-muted-foreground">
                Orden{" "}
                <b className="ml-1 text-foreground">
                  {bodega ? "Por cercanía" : "Por captura"}
                </b>
              </span>
            </div>
          </Card>

          <p className="flex items-center justify-center gap-1 pt-2 text-xs text-muted-foreground">
            <MapPin className="size-3.5" /> El aviso masivo “vamos en camino”
            llega en la Fase 7 (WhatsApp).
          </p>
        </>
      )}
    </div>
  );
}
