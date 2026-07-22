import {
  EncabezadoMovilSkeleton,
  KpiSkeleton,
  ListaSkeleton,
  TarjetaRentaSkeleton,
  TituloSkeleton,
} from "@/components/skeletons";

// Skeleton de "Hoy" (y respaldo de las rutas que no tienen el suyo): calca el
// encabezado móvil, los KPIs y las dos columnas de entregas / mañana.
export default function Loading() {
  return (
    <div className="space-y-6">
      <EncabezadoMovilSkeleton conSaludo conBoton conSubtitulo />

      {/* KPIs: 2 columnas en móvil, 3 en escritorio (el tercero es de admin). */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton className="col-span-2 lg:col-span-1" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_372px] lg:items-start">
        <div className="space-y-6">
          <section>
            <TituloSkeleton ancho="w-36" />
            <div className="space-y-3">
              <TarjetaRentaSkeleton />
              <TarjetaRentaSkeleton />
            </div>
          </section>
          <section>
            <TituloSkeleton ancho="w-44" />
            <div className="space-y-3">
              <TarjetaRentaSkeleton />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <TituloSkeleton ancho="w-24" />
            <ListaSkeleton filas={3} />
          </section>
          <section>
            <TituloSkeleton ancho="w-40" />
            <ListaSkeleton filas={4} />
          </section>
        </div>
      </div>
    </div>
  );
}
