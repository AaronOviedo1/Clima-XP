import { pesos } from "@/lib/dinero";
import type { Serie } from "@/lib/reportes";

// Gráfica de barras horizontal simple (sin dependencias externas).
export function Barras({
  datos,
  formato = "pesos",
}: {
  datos: Serie;
  formato?: "pesos" | "numero";
}) {
  if (datos.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Sin datos.</p>;
  }
  const max = Math.max(...datos.map((d) => d.valor), 1);
  const fmt = (v: number) => (formato === "pesos" ? pesos(v) : String(v));

  return (
    <div className="space-y-3">
      {datos.map((d, i) => (
        <div key={`${d.label}-${i}`} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="truncate font-semibold">{d.label}</span>
            <span className="shrink-0 font-extrabold tabular-nums">
              {d.sub ?? fmt(d.valor)}
            </span>
          </div>
          <div className="h-3.5 overflow-hidden rounded-md bg-muted">
            <div
              className="h-full rounded-md bg-[linear-gradient(90deg,#3871C1,#51ADE5)]"
              style={{ width: `${Math.max(2, (d.valor / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
