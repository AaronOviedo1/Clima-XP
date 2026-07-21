import Link from "next/link";
import {
  ChevronLeft,
  ChevronDown,
  MapPin,
  MessageCircle,
  Pencil,
  Calendar,
  Truck,
  Navigation,
} from "lucide-react";
import {
  totalesDeRenta,
  ESTADO_RENTA_META,
  ESTADO_CHIP,
  ESTADOS_EDITABLES,
  type EstadoRentaStr,
  type RentaCompleta,
} from "@/lib/rentas";
import { pesos } from "@/lib/dinero";
import { fechaCorta } from "@/lib/fechas";
import { formatoTelefono, paraWhatsApp } from "@/lib/telefono";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { RentaAcciones } from "@/components/renta-acciones";
import { RentaCorregirEstado } from "@/components/renta-corregir-estado";
import { PagoForm } from "@/components/pago-form";
import { PagoEliminarBoton } from "@/components/pago-eliminar-boton";

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

// Fila de la tarjeta de info (ícono + etiqueta + valor).
function FilaInfo({
  icono,
  label,
  value,
  borde = true,
}: {
  icono: React.ReactNode;
  label: string;
  value: React.ReactNode;
  borde?: boolean;
}) {
  return (
    <div className={"flex items-center gap-3 px-4 py-3.5" + (borde ? " border-b" : "")}>
      <span className="shrink-0 text-muted-foreground">{icono}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-[14.5px] font-semibold break-words">{value}</div>
      </div>
    </div>
  );
}

// Tarjeta colapsable (cerrada por defecto): el título es el <summary>.
function Colapsable({ titulo, children }: { titulo: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5">
          <span className="text-base font-semibold">{titulo}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t px-4 pt-3 pb-4">{children}</div>
      </details>
    </Card>
  );
}

// Tile de importe (Total / Pagado / Saldo) — estilo iOS.
function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-card p-3 shadow-sm">
      <div className="text-[12px] font-semibold text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[19px] font-extrabold tracking-tight tabular-nums ${color ?? ""}`}>
        {value}
      </div>
    </div>
  );
}

export function RentaDetalle({
  renta,
  esAdmin = false,
}: {
  renta: RentaCompleta;
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
  const editable = ESTADOS_EDITABLES.includes(renta.estado as EstadoRentaStr);

  // Resumen de equipos ("2 × Eco-Fresco, 1 × Turbo-Frío") y sus códigos.
  const porModelo = new Map<string, number>();
  for (const u of renta.unidades)
    porModelo.set(u.unidad.modelo.nombre, (porModelo.get(u.unidad.modelo.nombre) ?? 0) + 1);
  const equiposResumen = [...porModelo.entries()].map(([n, c]) => `${c} × ${n}`).join(", ");
  const codigos = renta.unidades.map((u) => u.unidad.codigo).join(", ");
  const periodo = `${fechaCorta(renta.fechaInicio)} – ${fechaCorta(renta.fechaFin)} · ${t.dias}d`;

  return (
    <div className="space-y-4">
      {/* Header móvil (sticky, blur): volver + WhatsApp */}
      <div className="sticky top-0 z-20 -mx-5 -mt-[calc(env(safe-area-inset-top)+14px)] flex items-center gap-2 border-b bg-background/80 px-3 pt-[calc(env(safe-area-inset-top)+10px)] pb-2.5 backdrop-blur-xl lg:hidden">
        <Link
          href="/rentas"
          className="flex items-center gap-0.5 px-2 py-1.5 text-[16px] font-semibold text-primary active:opacity-50"
        >
          <ChevronLeft className="size-[22px]" /> Rentas
        </Link>
        <div className="flex-1" />
        {editable && (
          <Button asChild variant="ghost" size="icon" aria-label="Editar renta">
            <Link href={`/rentas/${renta.id}/editar`}>
              <Pencil className="size-4" />
            </Link>
          </Button>
        )}
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-emerald-600 active:scale-90 dark:text-emerald-500"
          >
            <MessageCircle className="size-[18px]" />
          </a>
        )}
      </div>

      {/* Header desktop: volver + editar */}
      <div className="hidden items-center gap-2 lg:flex">
        <Button asChild variant="ghost" size="sm" className="text-primary">
          <Link href="/rentas">
            <ChevronLeft className="size-5" /> Rentas
          </Link>
        </Button>
        <div className="flex-1" />
        {editable && (
          <Button asChild variant="ghost" size="icon" aria-label="Editar renta">
            <Link href={`/rentas/${renta.id}/editar`}>
              <Pencil className="size-4" />
            </Link>
          </Button>
        )}
      </div>

      {/* Hero: cliente + teléfono a la izquierda; estado y corregir a la derecha */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/clientes/${renta.clienteId}`}
            className="block text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] hover:underline"
          >
            {renta.cliente.nombre}
          </Link>
          <div className="mt-1 text-[15px] text-muted-foreground">
            {formatoTelefono(renta.cliente.telefono)}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`inline-block rounded-lg px-2.5 py-1 text-[11px] font-extrabold tracking-wide uppercase ${ESTADO_CHIP[renta.estado] ?? "bg-muted text-muted-foreground"}`}
          >
            {meta.label}
          </span>
          {esAdmin && (
            <RentaCorregirEstado rentaId={renta.id} estado={renta.estado as EstadoRentaStr} />
          )}
        </div>
      </div>

      {/* Tiles de importe (solo admin) */}
      {esAdmin && (
        <div className="flex gap-3">
          <Tile label="Total" value={pesos(t.total)} />
          <Tile label="Pagado" value={pesos(t.pagadoConfirmado)} />
          <Tile
            label="Saldo"
            value={pesos(t.saldo)}
            color={t.saldo > 0 ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-500"}
          />
        </div>
      )}

      {/* Acciones de estado (En ruta / Entregado / Recogido) */}
      <RentaAcciones
        rentaId={renta.id}
        estado={renta.estado as EstadoRentaStr}
        tiposEquipo={tiposEquipo}
      />

      {/* Tarjeta de info: dirección, periodo, equipo */}
      <Card className="gap-0 overflow-hidden py-0">
        <FilaInfo
          icono={<MapPin className="size-[19px]" />}
          label="Dirección"
          value={<span className="whitespace-pre-wrap">{renta.direccion}</span>}
        />
        {renta.lugar && (
          <FilaInfo icono={<MapPin className="size-[19px]" />} label="Lugar" value={renta.lugar} />
        )}
        <FilaInfo
          icono={<Calendar className="size-[19px]" />}
          label="Periodo"
          value={periodo}
        />
        {renta.ventanaEntrega && (
          <FilaInfo
            icono={<Calendar className="size-[19px]" />}
            label="Ventana de entrega"
            value={renta.ventanaEntrega}
          />
        )}
        <FilaInfo
          icono={<Truck className="size-[19px]" />}
          label="Equipo"
          value={`${equiposResumen} · ${codigos}`}
          borde={!!renta.codigoAcceso}
        />
        {renta.codigoAcceso && (
          <FilaInfo
            icono={<MapPin className="size-[19px]" />}
            label="Código de acceso"
            value={renta.codigoAcceso}
            borde={false}
          />
        )}
      </Card>

      {/* Cómo llegar */}
      <Button asChild variant="secondary" className="h-12 w-full text-[15px] font-bold">
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
          <Navigation className="size-[18px]" /> Cómo llegar
        </a>
      </Button>

      {/* Equipos */}
      <Colapsable titulo={`Equipos (${renta.unidades.length}) · ${t.dias}d`}>
        <div className="space-y-1.5 text-sm">
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
        </div>
      </Colapsable>

      {/* Desglose */}
      <Colapsable titulo="Cuenta">
        <div className="space-y-2">
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
        </div>
      </Colapsable>

      {/* Pagos */}
      <Colapsable titulo="Pagos">
        <div className="space-y-3">
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
        </div>
      </Colapsable>

      {renta.notas && (
        <Colapsable titulo="Notas">
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{renta.notas}</p>
        </Colapsable>
      )}
    </div>
  );
}
