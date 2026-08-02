"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cambiarEstadoRenta, marcarEntregada, marcarRecogida } from "@/lib/actions/rentas";
import {
  TRANSICIONES,
  ACCION_ESTADO,
  type EstadoRentaStr,
} from "@/lib/rentas";
import { abrirWhatsApp, mensajeRecoleccion } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { DialogoEntrega } from "@/components/dialogo-entrega";
import { DialogoRecoleccion } from "@/components/dialogo-recoleccion";
import { MessageCircle } from "lucide-react";

// Mensaje de confirmación (toast) por estado destino.
const TOAST_ESTADO: Record<EstadoRentaStr, string> = {
  COTIZADA: "Marcada como cotización",
  CONFIRMADA: "Renta confirmada",
  EN_RUTA: "En ruta",
  ENTREGADA: "Renta entregada",
  RECOGIDA: "Recolección hecha",
  CONCLUIDA: "Renta concluida",
  CANCELADA: "Renta cancelada",
};

export function RentaAcciones({
  rentaId,
  estado,
  tiposEquipo,
  accesoriosEntregados = 0,
  telefono,
  equipos = 0,
}: {
  rentaId: string;
  estado: EstadoRentaStr;
  // Tipos de equipo de esta renta (AEROCOOLER/CALENTON): decide qué accesorios
  // ofrecer al marcar la entrega y cómo se le nombra al equipo en el WhatsApp.
  tiposEquipo: string[];
  // Cuántos accesorios salieron con la renta: con cero no hay nada que revisar
  // al recoger y el botón sigue siendo de un tap.
  accesoriosEntregados?: number;
  // Para avisarle al cliente que ya van a recoger. Sin teléfono no hay botón.
  telefono?: string | null;
  // Cuántas unidades lleva la renta: define el singular/plural del mensaje.
  equipos?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [dialogRecoleccion, setDialogRecoleccion] = useState(false);

  const destinos = TRANSICIONES[estado] ?? [];

  function ir(destino: EstadoRentaStr) {
    setError(null);
    start(async () => {
      const res = await cambiarEstadoRenta(rentaId, destino);
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(TOAST_ESTADO[destino]);
        router.refresh();
      }
    });
  }

  function confirmarRecoleccion(noRecogidos: string[]) {
    setError(null);
    start(async () => {
      const res = await marcarRecogida(rentaId, noRecogidos);
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        if (res.aviso) toast.warning(res.aviso);
        toast.success("Recolección hecha");
        setDialogRecoleccion(false);
        router.refresh();
      }
    });
  }

  function confirmarEntrega(accesorioIds: string[]) {
    setError(null);
    start(async () => {
      const res = await marcarEntregada(rentaId, accesorioIds);
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Renta entregada");
        setDialogAbierto(false);
        router.refresh();
      }
    });
  }

  if (destinos.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Con el equipo en casa del cliente, avisar que ya salieron por él.
            No cambia el estado (no existe un "en ruta a recoger"): abre
            WhatsApp con el mensaje listo. */}
        {estado === "ENTREGADA" && telefono && (
          <Button
            variant="secondary"
            className="h-11 flex-1"
            onClick={() => abrirWhatsApp(telefono, mensajeRecoleccion(tiposEquipo, equipos))}
          >
            <MessageCircle className="size-4" /> En camino
          </Button>
        )}
        {destinos.map((d) => {
          const cancelar = d === "CANCELADA";
          const esEntrega = d === "ENTREGADA";
          // Al recoger se revisan los accesorios que salieron con la renta.
          const esRecoleccion = d === "RECOGIDA" && accesoriosEntregados > 0;
          return (
            <Button
              key={d}
              variant={cancelar ? "outline" : "default"}
              className={"h-11 flex-1 " + (cancelar ? "text-destructive" : "")}
              disabled={pending}
              onClick={() =>
                esEntrega
                  ? setDialogAbierto(true)
                  : esRecoleccion
                    ? setDialogRecoleccion(true)
                    : ir(d)
              }
            >
              {/* Desde una cotización, "Confirmar" es en realidad aceptarla:
                  es cuando el equipo se aparta de verdad. */}
              {estado === "COTIZADA" && d === "CONFIRMADA"
                ? "Convertir en renta"
                : ACCION_ESTADO[d]}
            </Button>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogoEntrega
        tiposEquipo={tiposEquipo}
        abierto={dialogAbierto}
        onOpenChange={setDialogAbierto}
        onConfirmar={confirmarEntrega}
        pending={pending}
      />

      <DialogoRecoleccion
        rentaId={rentaId}
        abierto={dialogRecoleccion}
        onOpenChange={setDialogRecoleccion}
        onConfirmar={confirmarRecoleccion}
        pending={pending}
      />
    </div>
  );
}
