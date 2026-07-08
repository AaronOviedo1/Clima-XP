"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, MessageCircle, Truck, PackageCheck, PackageOpen } from "lucide-react";
import { cambiarEstadoRenta } from "@/lib/actions/rentas";
import type { TarjetaRenta } from "@/lib/dashboard";
import type { EstadoRentaStr } from "@/lib/rentas";
import { pesos } from "@/lib/dinero";
import { linkMapsPunto } from "@/lib/maps";
import { formatoTelefono, paraWhatsApp } from "@/lib/telefono";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function DashboardCard({ r }: { r: TarjetaRenta }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const wa = paraWhatsApp(r.telefono);
  const maps = linkMapsPunto(r.direccion, r.lat, r.lng);

  function accion(destino: EstadoRentaStr) {
    setError(null);
    start(async () => {
      const res = await cambiarEstadoRenta(r.id, destino);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/rentas/${r.id}`} className="min-w-0">
            <p className="truncate font-semibold hover:underline">
              {r.clienteNombre}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatoTelefono(r.telefono)}
            </p>
          </Link>
          <div className="text-right">
            {r.saldo > 0 ? (
              <span className="text-sm font-medium text-amber-600 dark:text-amber-500">
                Debe {pesos(r.saldo)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Pagado</span>
            )}
          </div>
        </div>

        <p className="text-sm">
          <span className="text-muted-foreground">{r.direccion}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {r.ventanaEntrega && <span>🕐 {r.ventanaEntrega}</span>}
          <span>{r.codigos.join(", ")}</span>
        </div>

        {/* Enlaces */}
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <a href={maps} target="_blank" rel="noopener noreferrer">
              <MapPin className="size-4" /> Maps
            </a>
          </Button>
          {wa && (
            <Button asChild variant="outline" size="sm" className="flex-1">
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </Button>
          )}
        </div>

        {/* Acciones de un tap según estado */}
        <div className="flex gap-2">
          {r.estado === "CONFIRMADA" && (
            <>
              <Button
                variant="secondary"
                className="h-11 flex-1"
                disabled={pending}
                onClick={() => accion("EN_RUTA")}
              >
                <Truck className="size-4" /> En ruta
              </Button>
              <Button
                className="h-11 flex-1"
                disabled={pending}
                onClick={() => accion("ENTREGADA")}
              >
                <PackageCheck className="size-4" /> Entregado
              </Button>
            </>
          )}
          {r.estado === "EN_RUTA" && (
            <Button
              className="h-11 flex-1"
              disabled={pending}
              onClick={() => accion("ENTREGADA")}
            >
              <PackageCheck className="size-4" /> Entregado
            </Button>
          )}
          {r.estado === "ENTREGADA" && (
            <Button
              className="h-11 flex-1"
              disabled={pending}
              onClick={() => accion("RECOGIDA")}
            >
              <PackageOpen className="size-4" /> Recogido
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
