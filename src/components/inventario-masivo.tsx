"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { editarUnidadesEnLote, eliminarUnidadesEnLote } from "@/lib/actions/inventario";
import type { LoteActionResult } from "@/lib/lote";
import { ESTADO_UNIDAD_META } from "@/lib/inventario";
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

const ESTADOS_UNIDAD = ["DISPONIBLE", "RENTADA", "MANTENIMIENTO", "BAJA"] as const;
type EstadoUnidad = (typeof ESTADOS_UNIDAD)[number];

const SIN_CAMBIO = "SIN_CAMBIO";
const TODOS = "TODOS";

export type UnidadMasiva = {
  id: string;
  codigo: string;
  estado: string;
  notas: string | null;
};

export type ModeloMasivo = {
  id: string;
  nombre: string;
  unidades: UnidadMasiva[];
};

// Selección múltiple de unidades (de todos los modelos) para cambiarles el
// estado / las notas de un jalón, o borrarlas. Evita abrir 20 pop-ups seguidos
// al final de temporada, cuando todo el inventario cambia de estado a la vez.
export function EdicionMasivaDialog({
  modelos,
  triggerClassName,
}: {
  modelos: ModeloMasivo[];
  // Para que el trigger adopte el tamaño del TopBar cuando vive en el navbar.
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [filtroEstado, setFiltroEstado] = useState<string>(TODOS);
  const [busqueda, setBusqueda] = useState("");
  const [nuevoEstado, setNuevoEstado] = useState<string>(SIN_CAMBIO);
  const [tocarNotas, setTocarNotas] = useState(false);
  const [notas, setNotas] = useState("");

  const q = busqueda.trim().toLowerCase();
  const grupos = useMemo(
    () =>
      modelos
        .map((m) => ({
          ...m,
          unidades: m.unidades.filter(
            (u) =>
              (filtroEstado === TODOS || u.estado === filtroEstado) &&
              (!q ||
                u.codigo.toLowerCase().includes(q) ||
                (u.notas ?? "").toLowerCase().includes(q) ||
                m.nombre.toLowerCase().includes(q)),
          ),
        }))
        .filter((m) => m.unidades.length > 0),
    [modelos, filtroEstado, q],
  );

  const visibles = useMemo(() => grupos.flatMap((g) => g.unidades), [grupos]);
  const idsSeleccionados = [...seleccion];
  const rentadasSeleccionadas = useMemo(
    () =>
      modelos
        .flatMap((m) => m.unidades)
        .filter((u) => seleccion.has(u.id) && u.estado === "RENTADA").length,
    [modelos, seleccion],
  );

  function alternar(id: string) {
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function alternarVarias(unidades: UnidadMasiva[], marcar: boolean) {
    setSeleccion((prev) => {
      const s = new Set(prev);
      for (const u of unidades) {
        if (marcar) s.add(u.id);
        else s.delete(u.id);
      }
      return s;
    });
  }

  function reiniciar() {
    setSeleccion(new Set());
    setFiltroEstado(TODOS);
    setBusqueda("");
    setNuevoEstado(SIN_CAMBIO);
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
        `${res.afectadas} ${res.afectadas === 1 ? "unidad" : "unidades"} ${verbo}` +
          (res.omitidas.length
            ? ` · ${res.omitidas.length} con historial: ${res.omitidas.join(", ")}`
            : ""),
      );
      setSeleccion(new Set());
      router.refresh();
    });
  }

  const puedeAplicar =
    idsSeleccionados.length > 0 && (nuevoEstado !== SIN_CAMBIO || tocarNotas);

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) reiniciar();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8", triggerClassName)}>
          <ListChecks className="size-3.5" /> Edición masiva
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>Edición masiva de unidades</DialogTitle>
        </DialogHeader>

        {/* Filtros */}
        <div className="space-y-2.5 border-b p-4">
          <Input
            value={busqueda}
            placeholder="Buscar por código, modelo o nota…"
            className="h-11"
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {[TODOS, ...ESTADOS_UNIDAD].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setFiltroEstado(e)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                  (filtroEstado === e
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-superficie-hover")
                }
              >
                {e === TODOS ? "Todas" : ESTADO_UNIDAD_META[e].label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-muted-foreground">
              {idsSeleccionados.length} de {visibles.length} seleccionadas
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => alternarVarias(visibles, true)}
              >
                Todas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setSeleccion(new Set())}
              >
                Ninguna
              </Button>
            </div>
          </div>
        </div>

        {/* Lista de unidades */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {grupos.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ninguna unidad coincide con el filtro.
            </p>
          )}
          {grupos.map((g) => {
            const todas = g.unidades.every((u) => seleccion.has(u.id));
            return (
              <div key={g.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    {g.nombre}
                  </p>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary"
                    onClick={() => alternarVarias(g.unidades, !todas)}
                  >
                    {todas ? "Quitar" : "Seleccionar"} {g.unidades.length}
                  </button>
                </div>
                <ul className="overflow-hidden rounded-lg border">
                  {g.unidades.map((u) => (
                    <li key={u.id} className="border-t first:border-t-0">
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                        <Checkbox
                          checked={seleccion.has(u.id)}
                          onCheckedChange={() => alternar(u.id)}
                        />
                        <span className="text-sm font-medium">{u.codigo}</span>
                        <span className={"text-xs " + ESTADO_UNIDAD_META[u.estado]?.clase}>
                          ● {ESTADO_UNIDAD_META[u.estado]?.label ?? u.estado}
                        </span>
                        {u.notas && (
                          <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
                            {u.notas}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Qué aplicar */}
        <div className="space-y-3 border-t p-4">
          <div className="space-y-2">
            <Label>Cambiar estado a</Label>
            <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_CAMBIO}>Sin cambio</SelectItem>
                {ESTADOS_UNIDAD.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESTADO_UNIDAD_META[e].label}
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

          {nuevoEstado === "DISPONIBLE" && (
            <p className="text-xs text-muted-foreground">
              Marcarlas como disponibles cierra sus mantenimientos abiertos.
            </p>
          )}
          {rentadasSeleccionadas > 0 && nuevoEstado !== SIN_CAMBIO && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {rentadasSeleccionadas}{" "}
              {rentadasSeleccionadas === 1
                ? "unidad seleccionada figura como rentada"
                : "unidades seleccionadas figuran como rentadas"}
              ; su estado normalmente cambia solo al recoger la renta.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button
              className="h-11"
              disabled={pending || !puedeAplicar}
              onClick={() =>
                ejecutar(
                  () =>
                    editarUnidadesEnLote({
                      unidadIds: idsSeleccionados,
                      estado:
                        nuevoEstado === SIN_CAMBIO
                          ? undefined
                          : (nuevoEstado as EstadoUnidad),
                      notas: tocarNotas ? notas : undefined,
                    }),
                  "actualizadas",
                )
              }
            >
              {pending
                ? "Aplicando…"
                : `Aplicar a ${idsSeleccionados.length} ${idsSeleccionados.length === 1 ? "unidad" : "unidades"}`}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 text-destructive"
                  aria-label="Eliminar unidades seleccionadas"
                  disabled={pending || idsSeleccionados.length === 0}
                >
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    ¿Eliminar {idsSeleccionados.length}{" "}
                    {idsSeleccionados.length === 1 ? "unidad" : "unidades"}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Solo se eliminan las que nunca han tenido rentas (sus
                    mantenimientos también se borran). Las que tengan historial se
                    saltan; márcalas como Baja.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="h-11 bg-destructive text-white hover:bg-destructive/90"
                    onClick={() =>
                      ejecutar(
                        () => eliminarUnidadesEnLote(idsSeleccionados),
                        "eliminadas",
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
