"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CanalOrigen } from "@prisma/client";
import { editarClientesEnLote, eliminarClientesEnLote } from "@/lib/actions/clientes";
import type { LoteActionResult } from "@/lib/lote";
import { CANAL_META, CANALES } from "@/lib/canales";
import { formatoTelefono } from "@/lib/telefono";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SIN_CAMBIO = "SIN_CAMBIO";
const TODOS = "TODOS";

export type ClienteMasivo = {
  id: string;
  nombre: string;
  telefono: string | null;
  canalOrigen: CanalOrigen;
  notas: string | null;
  rentas: number;
};

// Selección múltiple de clientes para cambiarles el canal de origen o las notas
// de un jalón, o borrar los que nunca rentaron (la migración del Excel dejó
// cientos de clientes con el mismo origen y con notas que hay que corregir).
export function EdicionMasivaClientesDialog({
  clientes,
  triggerClassName,
}: {
  clientes: ClienteMasivo[];
  // Para que el trigger adopte el tamaño del TopBar cuando vive en el navbar.
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [filtroCanal, setFiltroCanal] = useState<string>(TODOS);
  const [soloSinRentas, setSoloSinRentas] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [nuevoCanal, setNuevoCanal] = useState<string>(SIN_CAMBIO);
  const [tocarNotas, setTocarNotas] = useState(false);
  const [notas, setNotas] = useState("");

  const q = busqueda.trim().toLowerCase();
  const visibles = useMemo(
    () =>
      clientes.filter(
        (c) =>
          (filtroCanal === TODOS || c.canalOrigen === filtroCanal) &&
          (!soloSinRentas || c.rentas === 0) &&
          (!q ||
            c.nombre.toLowerCase().includes(q) ||
            (c.telefono ?? "").includes(q) ||
            (c.notas ?? "").toLowerCase().includes(q)),
      ),
    [clientes, filtroCanal, soloSinRentas, q],
  );

  const idsSeleccionados = [...seleccion];
  const conRentasSeleccionados = useMemo(
    () => clientes.filter((c) => seleccion.has(c.id) && c.rentas > 0).length,
    [clientes, seleccion],
  );

  function alternar(id: string) {
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function reiniciar() {
    setSeleccion(new Set());
    setFiltroCanal(TODOS);
    setSoloSinRentas(false);
    setBusqueda("");
    setNuevoCanal(SIN_CAMBIO);
    setTocarNotas(false);
    setNotas("");
    setError(null);
  }

  function ejecutar(fn: () => Promise<LoteActionResult>, verbo: string) {
    setError(null);
    start(async () => {
      const res = await fn();
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(
        `${res.afectadas} ${res.afectadas === 1 ? "cliente" : "clientes"} ${verbo}` +
          (res.omitidas.length
            ? ` · ${res.omitidas.length} con rentas se omitieron: ${res.omitidas.join(", ")}`
            : ""),
      );
      setSeleccion(new Set());
      router.refresh();
    });
  }

  const puedeAplicar =
    idsSeleccionados.length > 0 && (nuevoCanal !== SIN_CAMBIO || tocarNotas);

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) reiniciar();
      }}
    >
      <DialogTrigger asChild>
        {/* h-8 iguala al trigger de inventario en móvil; en el TopBar lo
            pisa el h-10 de CLASE_ACCION_TOP_BAR. */}
        <Button variant="outline" size="sm" className={cn("h-8", triggerClassName)}>
          <ListChecks className="size-4" />
          {/* En pantallas angostas comparte fila con el buscador: solo el ícono. */}
          <span className="hidden sm:inline">Edición masiva</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>Edición masiva de clientes</DialogTitle>
        </DialogHeader>

        {/* Filtros */}
        <div className="space-y-2.5 border-b p-4">
          <Input
            value={busqueda}
            placeholder="Buscar por nombre, teléfono o nota…"
            className="h-11"
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {[{ v: TODOS, l: "Todos" }, ...CANALES].map((c) => (
              <button
                key={c.v}
                type="button"
                onClick={() => setFiltroCanal(c.v)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                  (filtroCanal === c.v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-superficie-hover")
                }
              >
                {c.l}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={soloSinRentas}
              onCheckedChange={(v) => setSoloSinRentas(v === true)}
            />
            <span className="text-xs font-medium">Solo los que nunca han rentado</span>
          </label>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-muted-foreground">
              {idsSeleccionados.length} de {visibles.length} seleccionados
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() =>
                  setSeleccion((prev) => new Set([...prev, ...visibles.map((c) => c.id)]))
                }
              >
                Todos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setSeleccion(new Set())}
              >
                Ninguno
              </Button>
            </div>
          </div>
        </div>

        {/* Lista de clientes */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {visibles.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ningún cliente coincide con el filtro.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-lg border">
              {visibles.map((c) => (
                <li key={c.id} className="border-t first:border-t-0">
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                    <Checkbox
                      checked={seleccion.has(c.id)}
                      onCheckedChange={() => alternar(c.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.nombre}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatoTelefono(c.telefono) || "Sin teléfono"} ·{" "}
                        {CANAL_META[c.canalOrigen]?.etiqueta ?? c.canalOrigen} · {c.rentas}{" "}
                        {c.rentas === 1 ? "renta" : "rentas"}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Qué aplicar */}
        <div className="space-y-3 border-t p-4">
          <div className="space-y-2">
            <Label>Cambiar origen a</Label>
            <Select value={nuevoCanal} onValueChange={setNuevoCanal}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_CAMBIO}>Sin cambio</SelectItem>
                {CANALES.map((c) => (
                  <SelectItem key={c.v} value={c.v}>
                    {c.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={tocarNotas}
                onCheckedChange={(v) => setTocarNotas(v === true)}
              />
              <span className="text-sm font-medium">Reemplazar notas</span>
            </label>
            {tocarNotas && (
              <Input
                value={notas}
                placeholder="Vacío = borrar las notas"
                className="h-11"
                onChange={(e) => setNotas(e.target.value)}
              />
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button
              className="h-11"
              disabled={pending || !puedeAplicar}
              onClick={() =>
                ejecutar(
                  () =>
                    editarClientesEnLote({
                      clienteIds: idsSeleccionados,
                      canalOrigen:
                        nuevoCanal === SIN_CAMBIO ? undefined : (nuevoCanal as CanalOrigen),
                      notas: tocarNotas ? notas : undefined,
                    }),
                  "actualizados",
                )
              }
            >
              {pending
                ? "Aplicando…"
                : `Aplicar a ${idsSeleccionados.length} ${idsSeleccionados.length === 1 ? "cliente" : "clientes"}`}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 text-destructive"
                  aria-label="Eliminar clientes seleccionados"
                  disabled={pending || idsSeleccionados.length === 0}
                >
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    ¿Eliminar {idsSeleccionados.length}{" "}
                    {idsSeleccionados.length === 1 ? "cliente" : "clientes"}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Solo se eliminan los que nunca han rentado.
                    {conRentasSeleccionados > 0 &&
                      ` ${conRentasSeleccionados} de los seleccionados tienen rentas y se van a omitir.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="h-11 bg-destructive text-white hover:bg-destructive/90"
                    onClick={() =>
                      ejecutar(
                        () => eliminarClientesEnLote(idsSeleccionados),
                        "eliminados",
                      )
                    }
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
