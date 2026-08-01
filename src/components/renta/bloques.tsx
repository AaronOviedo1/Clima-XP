import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";

// Piezas visuales del diseño iOS que comparten el detalle de renta y el alta
// por pasos. Vivían dentro de renta-detalle.tsx; se sacaron aquí al rediseñar
// el alta para no tener dos versiones del mismo bloque.

export function Fila({
  label,
  value,
  fuerte,
}: {
  label: string;
  value: string;
  fuerte?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={fuerte ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

// Fila de la tarjeta de info (ícono + etiqueta + valor).
export function FilaInfo({
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

// Tarjeta colapsable: el título es el <summary>. `abierto` la deja desplegada
// de entrada (útil cuando lo de adentro ya tiene datos capturados).
export function Colapsable({
  titulo,
  children,
  abierto = false,
}: {
  titulo: React.ReactNode;
  children: React.ReactNode;
  abierto?: boolean;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <details className="group" open={abierto}>
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
export function Tile({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex-1 rounded-2xl bg-card p-3 shadow-sm">
      <div className="text-[12px] font-semibold text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[19px] font-extrabold tracking-tight tabular-nums ${color ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
