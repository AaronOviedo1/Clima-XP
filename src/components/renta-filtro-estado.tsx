"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ESTADOS_RENTA, ESTADO_RENTA_META } from "@/lib/rentas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Filtro de estado como selector (antes era una fila de badges que ocupaba
// mucho espacio horizontal). Sincroniza ?estado= preservando el resto de la URL.
export function RentaFiltroEstado({ estado }: { estado?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(valor: string) {
    const sp = new URLSearchParams(searchParams);
    if (valor === "todas") sp.delete("estado");
    else sp.set("estado", valor);
    const s = sp.toString();
    router.push(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  return (
    <Select value={estado ?? "todas"} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todas">Todas</SelectItem>
        {ESTADOS_RENTA.map((e) => (
          <SelectItem key={e} value={e}>
            {ESTADO_RENTA_META[e].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
