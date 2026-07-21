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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardCard } from "@/components/dashboard-card";
import { NotificacionesBoton } from "@/components/push/notificaciones-boton";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function KPI({
  icono,
  valor,
  label,
  bg,
  fg,
}: {
  icono: React.ReactNode;
  valor: number | string;
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <Card className="p-[18px]">
      <div className="flex items-center justify-between">
        <div
          className="flex size-10 items-center justify-center rounded-xl"
          style={{ background: bg, color: fg }}
        >
          {icono}
        </div>
      </div>
      <div className="mt-3.5 text-3xl font-extrabold tracking-tight tabular-nums">
        {valor}
      </div>
      <div className="text-[13px] font-semibold text-muted-foreground">
        {label}
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
      className="flex items-center gap-3 border-b border-[#f1f5fb] px-4 py-3 last:border-b-0 hover:bg-[#f8fafd]"
    >
      <span
        className={cn(
          "h-[34px] w-1.5 shrink-0 rounded",
          claseColorDia(renta.fechaInicio),
        )}
      />
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
      <div className="flex items-start justify-between gap-2 lg:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hoy</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {fechaLarga(hoy)}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/rentas/nueva">
            <Plus className="size-4" /> Renta
          </Link>
        </Button>
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
          bg="#e2edfb"
          fg="#2b5a9c"
        />
        <KPI
          icono={<PackageOpen className="size-5" />}
          valor={recolecciones.length}
          label="Recolecciones"
          bg="#dff0fb"
          fg="#1f6fb0"
        />
        {esAdmin && (
          <KPI
            icono={<Wallet className="size-5" />}
            valor={pesos(porCobrar)}
            label="Por cobrar"
            bg="#fde9e5"
            fg="#c0392b"
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
              <Card className="py-0">
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
              <Card className="py-0">
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
