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
    <div className="space-y-2">
      {datos.map((d, i) => (
        <div key={`${d.label}-${i}`} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{d.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {d.sub ?? fmt(d.valor)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(2, (d.valor / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
