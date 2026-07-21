import type { TipoEquipo } from "@prisma/client";
import { Wind, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

// Chip por tipo de equipo: viento azul para aerocooler, flama ámbar para calentón.
// Reutiliza los tonos de AV_PALETTE (azul #e2edfb/#2b5a9c, ámbar #fef3d6/#b45309).
const ESTILO: Record<
  TipoEquipo,
  { etiqueta: string; icono: typeof Wind; bg: string; fg: string }
> = {
  AEROCOOLER: { etiqueta: "Aerocooler", icono: Wind, bg: "#e2edfb", fg: "#2b5a9c" },
  CALENTON: { etiqueta: "Calentón", icono: Flame, bg: "#fef3d6", fg: "#b45309" },
};

export function DistintivoEquipos({
  tipos,
  soloIcono = false,
  className,
}: {
  tipos: TipoEquipo[];
  soloIcono?: boolean;
  className?: string;
}) {
  if (tipos.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {tipos.map((tipo) => {
        const { etiqueta, icono: Icono, bg, fg } = ESTILO[tipo];
        return (
          <span
            key={tipo}
            className={cn(
              "inline-flex items-center gap-1 rounded-full text-[11px] font-bold",
              soloIcono ? "size-5 justify-center" : "px-2 py-0.5"
            )}
            style={{ background: bg, color: fg }}
            title={etiqueta}
          >
            <Icono className="size-3" />
            {!soloIcono && etiqueta}
          </span>
        );
      })}
    </div>
  );
}
