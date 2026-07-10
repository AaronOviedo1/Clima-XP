import Link from "next/link";
import { Wind, Flame, TrendingUp, Receipt, Wallet, Users } from "lucide-react";
import { generarReportes, type PeriodoReporte, type Serie } from "@/lib/reportes";
import { pesos } from "@/lib/dinero";
import { Barras } from "@/components/barras";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function KPI({
  icono,
  valor,
  label,
}: {
  icono: React.ReactNode;
  valor: string;
  label: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-0.5 py-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icono} {label}
        </div>
        <div className="text-xl font-bold">{valor}</div>
      </CardContent>
    </Card>
  );
}

function Seccion({
  titulo,
  icono,
  children,
}: {
  titulo: string;
  icono?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icono}
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const { anio } = await searchParams;
  const periodo: PeriodoReporte = anio && /^\d{4}$/.test(anio) ? Number(anio) : "todos";

  const rep = await generarReportes(periodo);

  const tipoSerie: Serie = [
    {
      label: "Aerocoolers",
      valor: rep.porTipo.aerocooler,
      sub: `${pesos(rep.porTipo.aerocooler)} · ${rep.porTipo.rentasAero} rentas`,
    },
    {
      label: "Calentones",
      valor: rep.porTipo.calenton,
      sub: `${pesos(rep.porTipo.calenton)} · ${rep.porTipo.rentasCal} rentas`,
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>

      {/* Selector de periodo */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Link href="/reportes">
          <Badge
            variant={periodo === "todos" ? "default" : "outline"}
            className="cursor-pointer px-3 py-1"
          >
            Todos
          </Badge>
        </Link>
        {rep.aniosDisponibles.map((a) => (
          <Link key={a} href={`/reportes?anio=${a}`}>
            <Badge
              variant={periodo === a ? "default" : "outline"}
              className="cursor-pointer px-3 py-1"
            >
              {a}
            </Badge>
          </Link>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <KPI icono={<TrendingUp className="size-3.5" />} valor={pesos(rep.kpis.ingresos)} label="Ingresos" />
        <KPI icono={<Receipt className="size-3.5" />} valor={String(rep.kpis.numRentas)} label="Rentas" />
        <KPI icono={<Wallet className="size-3.5" />} valor={pesos(rep.kpis.ticketPromedio)} label="Ticket promedio" />
        <KPI icono={<Wallet className="size-3.5" />} valor={pesos(rep.kpis.porCobrar)} label="Por cobrar" />
      </div>

      <Seccion titulo={periodo === "todos" ? "Ingresos por año" : "Ingresos por mes"} icono={<TrendingUp className="size-4" />}>
        <Barras datos={rep.ingresosPorPeriodo} formato="pesos" />
      </Seccion>

      <Seccion titulo="Aerocoolers vs Calentones" icono={<Wind className="size-4" />}>
        <Barras datos={tipoSerie} formato="pesos" />
      </Seccion>

      <div className="grid gap-4 md:grid-cols-2">
        <Seccion titulo="Ingresos por método" icono={<Receipt className="size-4" />}>
          <Barras datos={rep.porMetodo} formato="pesos" />
        </Seccion>

        <Seccion titulo="Top clientes" icono={<Users className="size-4" />}>
          <Barras datos={rep.topClientes} formato="pesos" />
        </Seccion>
      </div>

      <Seccion titulo="Utilización por unidad" icono={<Flame className="size-4" />}>
        <Barras datos={rep.utilizacion} formato="numero" />
      </Seccion>

      {rep.porZona.length > 0 && (
        <Seccion titulo="Ingresos por domicilio (por km)" icono={<TrendingUp className="size-4" />}>
          <Barras datos={rep.porZona} formato="pesos" />
        </Seccion>
      )}
    </div>
  );
}
