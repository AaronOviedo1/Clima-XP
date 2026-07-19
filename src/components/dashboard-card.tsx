"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, MessageCircle, Truck, PackageCheck, PackageOpen, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { cambiarEstadoRenta, marcarEntregada } from "@/lib/actions/rentas";
import type { TarjetaRenta } from "@/lib/dashboard";
import { ENTREGA_HECHA, RECOLECCION_HECHA, type EstadoRentaStr } from "@/lib/rentas";
import { pesos } from "@/lib/dinero";
import { linkMapsPunto } from "@/lib/maps";
import { formatoTelefono, paraWhatsApp } from "@/lib/telefono";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogoEntrega } from "@/components/dialogo-entrega";
import { cn } from "@/lib/utils";

export function DashboardCard({
  r,
  mostrarSaldo = true,
  contexto,
  soloLectura = false,
}: {
  r: TarjetaRenta;
  mostrarSaldo?: boolean;
  // En qué sección vive la tarjeta: define cuándo se considera "hecha".
  contexto?: "entrega" | "recoleccion";
  // Sin acciones de un tap: para armar la ruta de un día que no es hoy, antes
  // de que la entrega realmente pase.
  soloLectura?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogEntrega, setDialogEntrega] = useState(false);

  const wa = paraWhatsApp(r.telefono);
  const maps = linkMapsPunto(r.direccion, r.lat, r.lng);

  const hecha =
    contexto === "entrega"
      ? ENTREGA_HECHA.includes(r.estado)
      : contexto === "recoleccion"
        ? RECOLECCION_HECHA.includes(r.estado)
        : false;

  function accion(destino: EstadoRentaStr) {
    setError(null);
    start(async () => {
      const res = await cambiarEstadoRenta(r.id, destino);
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(destino === "EN_RUTA" ? "En ruta" : "Recolección hecha");
        router.refresh();
      }
    });
  }

  // Entregar pregunta primero qué accesorios se dejaron (marcarEntregada los
  // registra); el resto de transiciones son de un tap directo.
  function confirmarEntrega(accesorioIds: string[]) {
    setError(null);
    start(async () => {
      const res = await marcarEntregada(r.id, accesorioIds);
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Renta entregada");
        setDialogEntrega(false);
        router.refresh();
      }
    });
  }

  return (
    <Card className={cn(hecha && "opacity-75")}>
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
          {mostrarSaldo && (
            <div className="text-right">
              {r.saldo > 0 ? (
                <span className="text-sm font-medium text-amber-600 dark:text-amber-500">
                  Debe {pesos(r.saldo)}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Pagado</span>
              )}
            </div>
          )}
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

        {/* Acciones de un tap según estado; si ya se atendió, solo la marca.
            En modo solo lectura (armando la ruta de otro día) no se muestran:
            no tiene sentido marcar "Entregado" antes de que pase el día. */}
        <div className="flex gap-2">
          {soloLectura && !hecha && (
            <p className="flex h-11 flex-1 items-center justify-center text-xs text-muted-foreground">
              Las acciones se habilitan el día de la entrega.
            </p>
          )}
          {hecha && (
            <div className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600/10 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CircleCheck className="size-4" />
              {contexto === "recoleccion" ? "Recogido" : "Entregado"}
            </div>
          )}
          {!soloLectura && !hecha && r.estado === "CONFIRMADA" && (
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
                onClick={() => setDialogEntrega(true)}
              >
                <PackageCheck className="size-4" /> Entregado
              </Button>
            </>
          )}
          {!soloLectura && !hecha && r.estado === "EN_RUTA" && (
            <Button
              className="h-11 flex-1"
              disabled={pending}
              onClick={() => setDialogEntrega(true)}
            >
              <PackageCheck className="size-4" /> Entregado
            </Button>
          )}
          {!soloLectura && !hecha && r.estado === "ENTREGADA" && (
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

      <DialogoEntrega
        tiposEquipo={r.tiposEquipo}
        abierto={dialogEntrega}
        onOpenChange={setDialogEntrega}
        onConfirmar={confirmarEntrega}
        pending={pending}
      />
    </Card>
  );
}
