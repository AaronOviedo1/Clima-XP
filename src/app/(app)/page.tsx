import Link from "next/link";
import { Plus, Truck, PackageOpen, Wallet } from "lucide-react";
import { auth } from "@/auth";
import { AUTH_HABILITADA, USUARIO_POR_DEFECTO } from "@/lib/auth-flag";
import { datosDelDia, tarjetaDesdeRenta } from "@/lib/dashboard";
import { fechaLarga } from "@/lib/fechas";
import { pesos } from "@/lib/dinero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardCard } from "@/components/dashboard-card";
import { RentaListItem } from "@/components/renta-list-item";

export const dynamic = "force-dynamic";

function KPI({
  icono,
  valor,
  label,
}: {
  icono: React.ReactNode;
  valor: number | string;
  label: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-0.5 py-3 text-center">
        <div className="text-muted-foreground">{icono}</div>
        <div className="text-2xl font-bold">{valor}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const session = AUTH_HABILITADA ? await auth() : null;
  const usuario = session?.user ?? USUARIO_POR_DEFECTO;
  const esAdmin = usuario.rol === "ADMIN";

  const { hoy, entregas, recolecciones, manana, saldos } = await datosDelDia({
    esAdmin,
    repartidorId: usuario.id,
  });

  const porCobrar = saldos.reduce((a, s) => a + s.saldo, 0);
  const nadaHoy =
    entregas.length === 0 && recolecciones.length === 0 && manana.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hoy</h1>
          <p className="text-sm capitalize text-muted-foreground">
            {fechaLarga(hoy)}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/rentas/nueva">
            <Plus className="size-4" /> Renta
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className={"grid gap-2 " + (esAdmin ? "grid-cols-3" : "grid-cols-2")}>
        <KPI
          icono={<Truck className="size-5" />}
          valor={entregas.length}
          label="Entregas hoy"
        />
        <KPI
          icono={<PackageOpen className="size-5" />}
          valor={recolecciones.length}
          label="Recolecciones"
        />
        {esAdmin && (
          <KPI
            icono={<Wallet className="size-5" />}
            valor={pesos(porCobrar)}
            label="Por cobrar"
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

      {/* Entregas de hoy */}
      {entregas.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Truck className="size-5" /> Entregas de hoy ({entregas.length})
          </h2>
          {entregas.map((r) => (
            <DashboardCard key={r.id} r={tarjetaDesdeRenta(r)} />
          ))}
        </section>
      )}

      {/* Recolecciones de hoy */}
      {recolecciones.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <PackageOpen className="size-5" /> Recolecciones de hoy (
            {recolecciones.length})
          </h2>
          {recolecciones.map((r) => (
            <DashboardCard key={r.id} r={tarjetaDesdeRenta(r)} />
          ))}
        </section>
      )}

      {/* Mañana */}
      {manana.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Mañana ({manana.length})</h2>
          <ul className="space-y-2">
            {manana.map((r) => (
              <li key={r.id}>
                <RentaListItem renta={r} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Saldos pendientes (solo admin) */}
      {esAdmin && saldos.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Wallet className="size-5" /> Saldos pendientes ({saldos.length})
          </h2>
          <ul className="space-y-2">
            {saldos.slice(0, 15).map(({ renta }) => (
              <li key={renta.id}>
                <RentaListItem renta={renta} />
              </li>
            ))}
          </ul>
          {saldos.length > 15 && (
            <Link
              href="/rentas?saldo=1"
              className="block text-center text-sm text-muted-foreground underline"
            >
              Ver todos ({saldos.length})
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
