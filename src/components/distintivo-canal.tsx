import type { CanalOrigen } from "@prisma/client";
import { CANAL_META } from "@/lib/canales";
import { cn } from "@/lib/utils";

// Chip del canal por el que llegó el cliente: cada canal con su color e ícono
// (WhatsApp verde, Messenger azul cielo, recomendación ámbar, recurrente azul).
export function DistintivoCanal({
  canal,
  className,
}: {
  canal: CanalOrigen;
  className?: string;
}) {
  const { etiqueta, icono: Icono, clase } = CANAL_META[canal] ?? CANAL_META.OTRO;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase",
        clase,
        className,
      )}
    >
      <Icono className="size-3" />
      {etiqueta}
    </span>
  );
}
