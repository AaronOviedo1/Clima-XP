import Link from "next/link";
import {
  Wind,
  Flame,
  TrendingUp,
  TrendingDown,
  Receipt,
  Wallet,
  Users,
} from "lucide-react";
import { generarReportes, type PeriodoReporte, type Serie } from "@/lib/reportes";
import { pesos } from "@/lib/dinero";
import { Barras } from "@/components/barras";
import { AccionesSeccion } from "@/components/desktop/seccion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

// --- Componentes de la vista de ESCRITORIO (se conservan) ---
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
    <Card className="p-[18px]">
      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
        {icono} {label}
      </div>
      <div className="mt-2 text-[27px] font-extrabold tracking-tight tabular-nums">
        {valor}
      </div>
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

// --- Componentes de la vista MÓVIL (estilo iOS del mockup) ---

// Encabezado de sección en mayúsculas gris (como el diseño).
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 mb-3 px-1 text-[12.5px] font-extrabold tracking-wide text-muted-foreground uppercase">
      {children}
    </div>
  );
}

function TileKpi({
  valor,
  label,
  color,
}: {
  valor: string;
  label: string;
  color?: string;
}) {
  return (
    <div className="flex-1 rounded-2xl bg-card p-[13px] shadow-sm">
      <div className={`text-[21px] leading-none font-extrabold tracking-tight tabular-nums ${color ?? ""}`}>
        {valor}
      </div>
      <div className="mt-1 text-[11.5px] font-semibold text-muted-foreground">{label}</div>
    </div>
  );
}

// Barra de progreso horizontal (método de pago / top clientes / utilización).
function BarraProg({
  label,
  derecha,
  pct,
  color,
}: {
  label: string;
  derecha: string;
  pct: number;
  color?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-2">
        <span className="truncate text-[13.5px] font-semibold">{label}</span>
        <span className="shrink-0 text-[13.5px] font-extrabold tabular-nums">{derecha}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(pct, 3)}%`, background: color ?? "var(--primary)" }}
        />
      </div>
    </div>
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

  // --- Derivados para la vista móvil ---
  const periodoLabel = periodo === "todos" ? "Histórico" : String(periodo);
  const maxBarra = Math.max(...rep.ingresosPorPeriodo.map((x) => x.valor), 1);
  const pico = rep.ingresosPorPeriodo.reduce(
    (best, x) => (x.valor > best.valor ? x : best),
    { label: "—", valor: 0 },
  );

  const totalRentasTipo = rep.porTipo.rentasAero + rep.porTipo.rentasCal;
  const coolerPct = totalRentasTipo ? Math.round((rep.porTipo.rentasAero / totalRentasTipo) * 100) : 0;

  const totalMetodo = rep.porMetodo.reduce((a, m) => a + m.valor, 0) || 1;
  const maxCliente = rep.topClientes[0]?.valor ?? 1;
  const maxUtil = rep.utilizacionModelo[0]?.valor ?? 1;

  const anios = [...rep.aniosDisponibles].sort((a, b) => a - b);

  return (
    <>
      {/* ---------- MÓVIL (estilo iOS del mockup) ---------- */}
      <div className="lg:hidden">
        <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em]">Reportes</h1>

        {/* Selector de periodo (segmented control) */}
        <div className="mt-4 flex gap-1 rounded-xl bg-muted p-1">
          {anios.map((a) => {
            const activo = periodo === a;
            return (
              <Link
                key={a}
                href={`/reportes?anio=${a}`}
                className={`flex h-[34px] flex-1 items-center justify-center rounded-[9px] text-[13.5px] font-bold transition-colors ${
                  activo
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {a}
              </Link>
            );
          })}
          <Link
            href="/reportes"
            className={`flex h-[34px] flex-1 items-center justify-center rounded-[9px] text-[13.5px] font-bold transition-colors ${
              periodo === "todos" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Todos
          </Link>
        </div>

        {/* Hero: facturación + tendencia */}
        <div className="mt-4 rounded-[22px] p-5 text-white shadow-[0_16px_32px_-16px_var(--primary)] brand-gradient">
          <div className="text-[13px] font-semibold opacity-90">Facturado · {periodoLabel}</div>
          <div className="mt-1 text-[38px] leading-none font-extrabold tracking-[-1.4px] tabular-nums">
            {pesos(rep.kpis.facturado)}
          </div>
          {rep.tendencia.mostrar && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[12.5px] font-extrabold">
                {rep.tendencia.sube ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {Math.abs(rep.tendencia.pct)}%
              </span>
              <span className="text-[12.5px] font-medium opacity-90">{rep.tendencia.label}</span>
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="mt-3.5 flex flex-wrap gap-[9px]">
          <TileKpi valor={String(rep.kpis.numRentas)} label="Rentas" />
          <TileKpi valor={pesos(rep.kpis.ticketPromedio)} label="Ticket promedio" />
          <TileKpi
            valor={pesos(rep.kpis.porCobrar)}
            label="Por cobrar"
            color="text-amber-600 dark:text-amber-500"
          />
          <TileKpi valor={pesos(rep.domicilio.ingresos)} label="Domicilios" />
        </div>

        {/* Ingresos por periodo */}
        <Rotulo>{periodo === "todos" ? "Ingresos por año" : "Ingresos por mes"}</Rotulo>
        <div className="rounded-[18px] bg-card p-[18px_14px_12px] shadow-sm">
          <div className="flex h-[120px] items-end justify-between gap-1">
            {rep.ingresosPorPeriodo.map((b) => (
              <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <div
                  className="w-full rounded-t-[5px] rounded-b-[2px] bg-primary"
                  style={{ height: `${Math.max((b.valor / maxBarra) * 100, 2)}%` }}
                />
                <span className="text-[9.5px] font-bold text-muted-foreground">{b.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 border-t pt-2.5">
            <span className="size-2.5 rounded-[3px] bg-primary" />
            <span className="text-[12px] font-semibold text-muted-foreground">
              Pico: {pico.label} · {pesos(pico.valor)}
            </span>
          </div>
        </div>

        {/* Distribución por equipo (donut) */}
        <Rotulo>Distribución por equipo</Rotulo>
        <div className="flex items-center gap-5 rounded-[18px] bg-card p-[18px] shadow-sm">
          <div
            className="flex size-24 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--primary) 0 ${coolerPct}%, var(--calenton) ${coolerPct}% 100%)`,
            }}
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-card text-[15px] font-extrabold tabular-nums">
              {coolerPct}%
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="size-3 rounded-[4px] bg-primary" />
              <div>
                <div className="text-sm font-bold">Aerocoolers</div>
                <div className="text-[12px] font-semibold text-muted-foreground">
                  {rep.porTipo.rentasAero} rentas
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="size-3 rounded-[4px] bg-[var(--calenton)]" />
              <div>
                <div className="text-sm font-bold">Calentones</div>
                <div className="text-[12px] font-semibold text-muted-foreground">
                  {rep.porTipo.rentasCal} rentas
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Método de pago */}
        {rep.porMetodo.length > 0 && (
          <>
            <Rotulo>Método de pago</Rotulo>
            <div className="flex flex-col gap-3.5 rounded-[18px] bg-card p-4 shadow-sm">
              {rep.porMetodo.map((p) => {
                const pct = Math.round((p.valor / totalMetodo) * 100);
                return <BarraProg key={p.label} label={p.label} derecha={`${pct}%`} pct={pct} />;
              })}
            </div>
          </>
        )}

        {/* Top clientes */}
        {rep.topClientes.length > 0 && (
          <>
            <Rotulo>Top clientes</Rotulo>
            <div className="rounded-[18px] bg-card px-4 py-1.5 shadow-sm">
              {rep.topClientes.slice(0, 5).map((c, i) => (
                <div
                  key={c.label + i}
                  className="flex items-center gap-3 border-b py-3 last:border-b-0"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[12.5px] font-extrabold text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{c.label}</div>
                    <div className="mt-1.5 h-[5px] overflow-hidden rounded-[3px] bg-muted">
                      <div
                        className="h-full rounded-[3px] bg-[#51ade5]"
                        style={{ width: `${Math.max((c.valor / maxCliente) * 100, 3)}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums">{pesos(c.valor)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Utilización por modelo */}
        {rep.utilizacionModelo.length > 0 && (
          <>
            <Rotulo>Utilización por modelo</Rotulo>
            <div className="flex flex-col gap-3.5 rounded-[18px] bg-card p-4 shadow-sm">
              {rep.utilizacionModelo.map((u) => (
                <BarraProg
                  key={u.label}
                  label={u.label}
                  derecha={String(u.valor)}
                  pct={(u.valor / maxUtil) * 100}
                  color={u.sub === "CALENTON" ? "var(--calenton)" : "var(--primary)"}
                />
              ))}
            </div>
          </>
        )}

        {/* Domicilio */}
        {rep.domicilio.recorridos > 0 && (
          <>
            <Rotulo>Domicilio</Rotulo>
            <div className="flex gap-[9px]">
              <TileKpi valor={String(rep.domicilio.recorridos)} label="Entregas a domicilio" />
              {rep.domicilio.km > 0 && <TileKpi valor={`${rep.domicilio.km} km`} label="Recorridos" />}
              <TileKpi valor={pesos(rep.domicilio.ingresos)} label="Ingreso" />
            </div>
          </>
        )}
      </div>

      {/* ---------- ESCRITORIO (se conserva) ---------- */}
      <div className="hidden space-y-5 lg:block">
        {/* El selector de periodo vive en el navbar (segmented control). */}
        <AccionesSeccion>
          <div className="flex h-10 items-center gap-1 rounded-xl bg-superficie-suave p-1">
            {[
              ...anios.map((a) => ({
                href: `/reportes?anio=${a}`,
                label: String(a),
                activo: periodo === a,
              })),
              { href: "/reportes", label: "Todos", activo: periodo === "todos" },
            ].map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className={`flex h-8 items-center rounded-lg px-3 text-[13px] font-bold transition-colors ${
                  t.activo
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </AccionesSeccion>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPI icono={<TrendingUp className="size-3.5" />} valor={pesos(rep.kpis.ingresos)} label="Ingresos" />
          <KPI icono={<Receipt className="size-3.5" />} valor={String(rep.kpis.numRentas)} label="Rentas" />
          <KPI icono={<Wallet className="size-3.5" />} valor={pesos(rep.kpis.ticketPromedio)} label="Ticket promedio" />
          <KPI icono={<Wallet className="size-3.5" />} valor={pesos(rep.kpis.porCobrar)} label="Por cobrar" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <Seccion titulo={periodo === "todos" ? "Ingresos por año" : "Ingresos por mes"} icono={<TrendingUp className="size-4" />}>
            <Barras datos={rep.ingresosPorPeriodo} formato="pesos" />
          </Seccion>

          <Seccion titulo="Aerocoolers vs Calentones" icono={<Wind className="size-4" />}>
            <Barras datos={tipoSerie} formato="pesos" />
          </Seccion>
        </div>

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
    </>
  );
}
