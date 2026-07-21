import Link from "next/link";
import { ChevronLeft, MapPin, MessageCircle, Pencil } from "lucide-react";
import {
  totalesDeRenta,
  ESTADO_RENTA_META,
  ESTADOS_EDITABLES,
  type EstadoRentaStr,
  type RentaCompleta,
} from "@/lib/rentas";
import { pesos } from "@/lib/dinero";
import { fechaLarga } from "@/lib/fechas";
import { formatoTelefono, paraWhatsApp } from "@/lib/telefono";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RentaAcciones } from "@/components/renta-acciones";
import { RentaCorregirEstado } from "@/components/renta-corregir-estado";
import { PagoForm } from "@/components/pago-form";
import { PagoEliminarBoton } from "@/components/pago-eliminar-boton";
import { cn } from "@/lib/utils";

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  LINK_MERCADO_PAGO: "Mercado Pago",
  OTRO: "Otro",
};

function Fila({ label, value, fuerte }: { label: string; value: string; fuerte?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={fuerte ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

export function RentaDetalle({
  renta,
  enModal = false,
  esAdmin = false,
}: {
  renta: RentaCompleta;
  enModal?: boolean;
  esAdmin?: boolean;
}) {
  const t = totalesDeRenta(renta);
  const meta = ESTADO_RENTA_META[renta.estado];
  const tiposEquipo = [...new Set(renta.unidades.map((u) => u.unidad.modelo.tipo))];
  const wa = paraWhatsApp(renta.cliente.telefono);
  const mapsQuery =
    renta.lat != null && renta.lng != null
      ? `${renta.lat},${renta.lng}`
      : encodeURIComponent(renta.direccion);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <div className="space-y-4">
      <div className={cn("flex items-center gap-2", enModal && "pr-8")}>
        {!enModal && (
          <Button asChild variant="ghost" size="icon" aria-label="Volver">
            <Link href="/rentas">
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
        )}
        <div className="flex-1">
          <Link
            href={`/clientes/${renta.clienteId}`}
            className="text-xl font-bold tracking-tight hover:underline"
          >
            {renta.cliente.nombre}
          </Link>
          <div className="text-sm text-muted-foreground">
            {formatoTelefono(renta.cliente.telefono)}
          </div>
        </div>
        {ESTADOS_EDITABLES.includes(renta.estado as EstadoRentaStr) && (
          <Button asChild variant="ghost" size="icon" aria-label="Editar renta">
            <Link href={`/rentas/${renta.id}/editar`}>
              <Pencil className="size-4" />
            </Link>
          </Button>
        )}
        <Badge variant={meta.badge}>{meta.label}</Badge>
      </div>

      {esAdmin && (
        <div className="flex justify-end">
          <RentaCorregirEstado rentaId={renta.id} estado={renta.estado as EstadoRentaStr} />
        </div>
      )}

      {/* Acciones de estado */}
      <RentaAcciones
        rentaId={renta.id}
        estado={renta.estado as EstadoRentaStr}
        tiposEquipo={tiposEquipo}
      />

      {/* Entrega */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Entrega</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Fila label="Entrega" value={fechaLarga(renta.fechaInicio)} />
          <Fila label="Recolección" value={fechaLarga(renta.fechaFin)} />
          {renta.ventanaEntrega && <Fila label="Ventana" value={renta.ventanaEntrega} />}
          {renta.lugar && <Fila label="Lugar" value={renta.lugar} />}
          <div>
            <p className="text-muted-foreground">Dirección</p>
            <p className="whitespace-pre-wrap">{renta.direccion}</p>
          </div>
          {renta.codigoAcceso && <Fila label="Código de acceso" value={renta.codigoAcceso} />}
          <div className="flex gap-2 pt-1">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
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
        </CardContent>
      </Card>

      {/* Equipos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Equipos ({renta.unidades.length}) · {t.dias}d
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {renta.unidades.map((ru) => (
            <div key={ru.id} className="flex items-center justify-between">
              <span>
                <span className="font-medium">{ru.unidad.codigo}</span>{" "}
                <span className="text-muted-foreground">{ru.unidad.modelo.nombre}</span>
              </span>
              <span>{pesos(ru.precioDia)}/día</span>
            </div>
          ))}
          {renta.accesorios.length > 0 && (
            <>
              <Separator className="my-2" />
              {renta.accesorios.map((ra) => (
                <div key={ra.id} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{ra.accesorio.descripcion}</span>
                  <span>{ra.cargo > 0 ? pesos(ra.cargo) : "—"}</span>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Desglose */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Fila label={`Equipos (${t.dias}d)`} value={pesos(t.subtotalEquipos)} />
          {t.subtotalAccesorios > 0 && (
            <Fila label="Accesorios" value={pesos(t.subtotalAccesorios)} />
          )}
          <Fila label="Domicilio" value={pesos(t.costoDomicilio)} />
          {t.descuentoMonto > 0 && (
            <Fila label={`Descuento${renta.descuentoNota ? ` (${renta.descuentoNota})` : ""}`} value={`−${pesos(t.descuentoMonto)}`} />
          )}
          <Separator className="my-1" />
          <Fila label="Total" value={pesos(t.total)} fuerte />
          <Fila label="Pagado" value={pesos(t.pagadoConfirmado)} />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Saldo</span>
            <span
              className={
                "text-lg font-bold " +
                (t.saldo > 0 ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-500")
              }
            >
              {pesos(t.saldo)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Pagos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pagos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {renta.pagos.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {renta.pagos.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span>
                    <Badge variant="outline" className="mr-2">
                      {p.tipo === "REEMBOLSO" ? "Reembolso" : p.tipo === "ANTICIPO" ? "Anticipo" : "Pago"}
                    </Badge>
                    <span className="text-muted-foreground">{METODO_LABEL[p.metodo]}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={p.tipo === "REEMBOLSO" ? "text-destructive" : ""}>
                      {p.tipo === "REEMBOLSO" ? "−" : ""}
                      {pesos(p.monto)}
                    </span>
                    {esAdmin && <PagoEliminarBoton rentaId={renta.id} pagoId={p.id} />}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <PagoForm rentaId={renta.id} saldo={t.saldo} />
        </CardContent>
      </Card>

      {renta.notas && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notas</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {renta.notas}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
