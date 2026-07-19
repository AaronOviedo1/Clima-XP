"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registrarPago } from "@/lib/actions/rentas";
import { pesos } from "@/lib/dinero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const METODOS = [
  { v: "EFECTIVO", l: "Efectivo" },
  { v: "TRANSFERENCIA", l: "Transferencia" },
  { v: "LINK_MERCADO_PAGO", l: "Link Mercado Pago" },
  { v: "OTRO", l: "Otro" },
];

export function PagoForm({
  rentaId,
  saldo,
}: {
  rentaId: string;
  saldo: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [monto, setMonto] = useState<number>(saldo > 0 ? saldo : 0);
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [tipo, setTipo] = useState("LIQUIDACION");
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    if (monto <= 0) return setError("El monto debe ser mayor a 0.");
    start(async () => {
      const res = await registrarPago(rentaId, {
        monto,
        metodo: metodo as never,
        tipo: tipo as never,
      });
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Pago registrado");
        setMonto(0);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="monto">Monto</Label>
          <Input
            id="monto"
            type="number"
            inputMode="numeric"
            value={monto === 0 ? "" : monto}
            placeholder="0"
            className="h-11"
            onChange={(e) => setMonto(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Método</Label>
          <Select value={metodo} onValueChange={setMetodo}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METODOS.map((m) => (
                <SelectItem key={m.v} value={m.v}>
                  {m.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LIQUIDACION">Liquidación</SelectItem>
            <SelectItem value="ANTICIPO">Anticipo</SelectItem>
            <SelectItem value="REEMBOLSO">Reembolso</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="h-11 w-full" disabled={pending} onClick={onSubmit}>
        {pending ? "Registrando…" : `Registrar ${monto > 0 ? pesos(monto) : "pago"}`}
      </Button>
    </div>
  );
}
