import Image from "next/image";
import Link from "next/link";
import { Plus, Truck, PackageOpen, Wallet } from "lucide-react";
import { auth } from "@/auth";
import { AUTH_HABILITADA, USUARIO_POR_DEFECTO } from "@/lib/auth-flag";
import { datosDelDia, tarjetaDesdeRenta } from "@/lib/dashboard";
import { fechaCorta, fechaLarga } from "@/lib/fechas";
import { pesos } from "@/lib/dinero";
import { equiposPorModelo, totalesDeRenta } from "@/lib/rentas";
import { claseColorDia } from "@/lib/colores-dia";
import type { RentaListItemData } from "@/components/renta-list-item";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardCard } from "@/components/dashboard-card";
import { NotificacionesBoton } from "@/components/push/notificaciones-boton";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Saludo según la hora local del negocio (Hermosillo, UTC−7 fijo).
function saludoDeHoy(): string {
  const h = (new Date().getUTCHours() - 7 + 24) % 24;
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

function KPI({
  icono,
  valor,
  label,
  bg,
  fg,
  wide = false,
}: {
  icono: React.ReactNode;
  valor: number | string;
  label: string;
  bg: string;
  fg: string;
  // En móvil ocupa la fila completa (p. ej. "Por cobrar").
  wide?: boolean;
}) {
  return (
    <Card className={cn("p-4", wide && "col-span-2 lg:col-span-1")}>
      <div className="flex items-center gap-3.5">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: bg, color: fg }}
        >
          {icono}
        </div>
        <div className="min-w-0">
          <div className="text-2xl leading-none font-extrabold tracking-tight tabular-nums">
            {valor}
          </div>
          <div className="mt-1 truncate text-[13px] font-semibold text-muted-foreground">
            {label}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Titulo({
  icono,
  color,
  children,
  n,
}: {
  icono: React.ReactNode;
  color?: string;
  children: React.ReactNode;
  n?: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      {icono && (
        <span className="flex" style={color ? { color } : undefined}>
          {icono}
        </span>
      )}
      <h2 className="text-base font-extrabold tracking-tight">{children}</h2>
      {n !== undefined && (
        <span className="text-[13px] font-bold text-[#94a3b8]">{n}</span>
      )}
    </div>
  );
}

// Fila compacta para la columna derecha (Mañana / Saldos): solo lectura.
function FilaCompacta({
  renta,
  extra,
  mostrarMonto,
}: {
  renta: RentaListItemData;
  extra?: React.ReactNode;
  mostrarMonto?: React.ReactNode;
}) {
  const equipos = equiposPorModelo(renta.unidades);
  return (
    <Link
      href={`/rentas/${renta.id}`}
      className={cn(
        "flex items-center gap-3 border-b border-black/[0.04] px-4 py-3 transition last:border-b-0 hover:brightness-[0.97] dark:hover:brightness-110",
        claseColorDia(renta.fechaInicio),
      )}
    >
      <span className="h-[34px] w-1.5 shrink-0 rounded bg-black/15 dark:bg-white/20" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{renta.cliente.nombre}</div>
        <div className="truncate text-xs text-[#94a3b8]">
          {extra ??
            equipos.map((e) => `${e.cantidad} × ${e.nombre}`).join(" · ")}
        </div>
      </div>
      {mostrarMonto}
    </Link>
  );
}

export default async function DashboardPage() {
  const session = AUTH_HABILITADA ? await auth() : null;
  const usuario = session?.user ?? USUARIO_POR_DEFECTO;
  const esAdmin = usuario.rol === "ADMIN";

  const { hoy, entregas, recolecciones, manana, saldos } = await datosDelDia({
    esAdmin,
  });

  const porCobrar = saldos.reduce((a, s) => a + s.saldo, 0);
  const nadaHoy =
    entregas.length === 0 && recolecciones.length === 0 && manana.length === 0;

  return (
    <div className="space-y-6">
      {/* Header solo móvil (en desktop lo cubre el TopBar) */}
      <div className="relative flex items-start justify-between gap-3 lg:hidden">
        <Image
          src="/HD_sinFondo.png"
          alt="ClimaXpress"
          width={1449}
          height={1428}
          priority
          className="pointer-events-none absolute top-0 left-1/2 h-12 w-auto -translate-x-1/2 opacity-90"
        />
        <div className="relative">
          <div className="text-sm font-semibold text-muted-foreground">
            {saludoDeHoy()}
          </div>
          <h1 className="text-[34px] leading-[1.05] font-extrabold tracking-[-0.02em]">
            Hoy
          </h1>
          <div className="mt-0.5 text-[13.5px] font-medium text-muted-foreground first-letter:uppercase">
            {fechaLarga(hoy)}
          </div>
        </div>
        <Link
          href="/rentas/nueva"
          className="relative mt-1.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_18px_-8px_var(--primary)] transition-transform active:scale-90"
        >
          <Plus className="size-[22px]" strokeWidth={2.4} />
        </Link>
      </div>

      {/* Único punto que alcanzan los dos roles para activar avisos. */}
      <NotificacionesBoton clavePublica={process.env.VAPID_PUBLIC_KEY ?? null} />

      {/* KPIs */}
      <div
        className={cn(
          "grid gap-4",
          esAdmin ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2",
        )}
      >
        <KPI
          icono={<Truck className="size-5" />}
          valor={entregas.length}
          label="Entregas hoy"
          bg="var(--kpi1a)"
          fg="var(--kpi1b)"
        />
        <KPI
          icono={<PackageOpen className="size-5" />}
          valor={recolecciones.length}
          label="Recolecciones"
          bg="var(--kpi2a)"
          fg="var(--kpi2b)"
        />
        {esAdmin && (
          <KPI
            icono={<Wallet className="size-5" />}
            valor={pesos(porCobrar)}
            label="Por cobrar"
            bg="var(--kpi3a)"
            fg="var(--kpi3b)"
            wide
          />
        )}
      </div>

      {nadaHoy && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nada programado para hoy ni mañana. 🌤️
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_372px] lg:items-start">
        {/* Columna principal: entregas + recolecciones */}
        <div className="space-y-6">
          {entregas.length > 0 && (
            <section>
              <Titulo
                icono={<Truck className="size-[18px]" />}
                color="var(--color-primary)"
                n={entregas.length}
              >
                Entregas de hoy
              </Titulo>
              <div className="space-y-3">
                {entregas.map((r) => (
                  <DashboardCard
                    key={r.id}
                    r={tarjetaDesdeRenta(r, { conDinero: esAdmin })}
                    mostrarSaldo={esAdmin}
                    contexto="entrega"
                  />
                ))}
              </div>
            </section>
          )}

          {recolecciones.length > 0 && (
            <section>
              <Titulo
                icono={<PackageOpen className="size-[18px]" />}
                color="#51ADE5"
                n={recolecciones.length}
              >
                Recolecciones de hoy
              </Titulo>
              <div className="space-y-3">
                {recolecciones.map((r) => (
                  <DashboardCard
                    key={r.id}
                    r={tarjetaDesdeRenta(r, { conDinero: esAdmin })}
                    mostrarSaldo={esAdmin}
                    contexto="recoleccion"
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Columna lateral: mañana + saldos */}
        <div className="space-y-6">
          {manana.length > 0 && (
            <section>
              <Titulo icono={null} n={manana.length}>
                Mañana
              </Titulo>
              <Card className="gap-0 py-0">
                {manana.map((r) => (
                  <FilaCompacta
                    key={r.id}
                    renta={r}
                    mostrarMonto={
                      esAdmin ? (
                        <span className="text-[13.5px] font-extrabold tabular-nums">
                          {pesos(totalesDeRenta(r).total)}
                        </span>
                      ) : undefined
                    }
                  />
                ))}
              </Card>
            </section>
          )}

          {esAdmin && saldos.length > 0 && (
            <section>
              <Titulo
                icono={<Wallet className="size-[18px]" />}
                color="#d97706"
                n={saldos.length}
              >
                Saldos pendientes
              </Titulo>
              <Card className="gap-0 py-0">
                {saldos.slice(0, 8).map(({ renta, saldo }) => (
                  <FilaCompacta
                    key={renta.id}
                    renta={renta}
                    extra={`${fechaCorta(renta.fechaInicio)}`}
                    mostrarMonto={
                      <span className="text-[13.5px] font-extrabold text-[#d97706] tabular-nums">
                        Debe {pesos(saldo)}
                      </span>
                    }
                  />
                ))}
                {saldos.length > 8 && (
                  <div className="p-3 text-center">
                    <Link
                      href="/rentas?saldo=1"
                      className="text-[13px] font-bold text-primary hover:underline"
                    >
                      Ver todos →
                    </Link>
                  </div>
                )}
              </Card>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
