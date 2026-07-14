"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

// Caja de búsqueda que sincroniza ?q= en la URL (con debounce) preservando
// el resto de los parámetros. El filtrado ocurre en el server component.
export function Buscador({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [texto, setTexto] = useState(searchParams.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function aplicar(q: string) {
    const sp = new URLSearchParams(searchParams);
    if (q.trim()) sp.set("q", q.trim());
    else sp.delete("q");
    const s = sp.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  function onChange(q: string) {
    setTexto(q);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => aplicar(q), 350);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={texto}
        placeholder={placeholder}
        className="h-11 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
        onChange={(e) => onChange(e.target.value)}
      />
      {texto && (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          onClick={() => {
            setTexto("");
            if (timer.current) clearTimeout(timer.current);
            aplicar("");
          }}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
