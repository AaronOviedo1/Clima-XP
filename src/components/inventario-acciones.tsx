"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  cambiarEstadoTambo,
  crearAccesorio,
  crearUnidad,
  editarPreciosModelo,
  editarUnidad,
  eliminarAccesorio,
  eliminarUnidad,
  reportarMantenimiento,
  resolverMantenimiento,
  type InventarioActionResult,
} from "@/lib/actions/inventario";
import { ESTADO_UNIDAD_META } from "@/lib/inventario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ESTADOS_UNIDAD = ["DISPONIBLE", "RENTADA", "MANTENIMIENTO", "BAJA"] as const;

const ESTADOS_TAMBO = [
  { v: "LLENO", l: "Lleno" },
  { v: "VACIO", l: "Vacío" },
  { v: "EN_CLIENTE", l: "En cliente" },
] as const;

const TIPOS_ACCESORIO = [
  { v: "MANGUERA", l: "Manguera" },
  { v: "EXTENSION", l: "Extensión" },
  { v: "TAMBO_GAS", l: "Tambo de gas" },
] as const;

// Envía una acción, muestra el error si lo hay y refresca al cerrar.
function useAccion(alTerminar: () => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function ejecutar(
    fn: () => Promise<InventarioActionResult>,
    mensajeExito?: string,
  ) {
    setError(null);
    start(async () => {
      const res = await fn();
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        if (mensajeExito) toast.success(mensajeExito);
        alTerminar();
        router.refresh();
      }
    });
  }
  return { pending, error, ejecutar, setError };
}

// ---------- Precios del modelo ----------
export function PreciosDialog({
  modelo,
}: {
  modelo: { id: string; nombre: string; precioDia: number; precioDia3Mas: number | null };
}) {
  const [abierto, setAbierto] = useState(false);
  const [precioDia, setPrecioDia] = useState(modelo.precioDia);
  const [precio3Mas, setPrecio3Mas] = useState(modelo.precioDia3Mas ?? 0);
  const { pending, error, ejecutar } = useAccion(() => setAbierto(false));

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Editar precios">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Precios · {modelo.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pd">Precio por día</Label>
            <Input
              id="pd"
              type="number"
              inputMode="numeric"
              value={precioDia === 0 ? "" : precioDia}
              placeholder="0"
              className="h-11"
              onChange={(e) => setPrecioDia(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p3">Precio con 3+ unidades (opcional)</Label>
            <Input
              id="p3"
              type="number"
              inputMode="numeric"
              value={precio3Mas === 0 ? "" : precio3Mas}
              placeholder="Sin precio 3+"
              className="h-11"
              onChange={(e) => setPrecio3Mas(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            className="h-11 w-full"
            disabled={pending}
            onClick={() =>
              ejecutar(
                () =>
                  editarPreciosModelo(modelo.id, {
                    precioDia,
                    precioDia3Mas: precio3Mas > 0 ? precio3Mas : null,
                  }),
                "Precios guardados",
              )
            }
          >
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Unidad: editar / reportar falla ----------
export function UnidadDialog({
  unidad,
}: {
  unidad: { id: string; codigo: string; estado: string; notas: string | null };
}) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState(unidad.codigo);
  const [estado, setEstado] = useState(unidad.estado);
  const [notas, setNotas] = useState(unidad.notas ?? "");
  const [reportando, setReportando] = useState(false);
  const [falla, setFalla] = useState("");
  const [costoFalla, setCostoFalla] = useState(0);
  const { pending, error, ejecutar } = useAccion(() => setAbierto(false));

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) {
          setCodigo(unidad.codigo);
          setEstado(unidad.estado);
          setNotas(unidad.notas ?? "");
          setReportando(false);
          setFalla("");
          setCostoFalla(0);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-muted"
          title={unidad.notas ?? undefined}
        >
          <span className="font-medium">{unidad.codigo}</span>
          <span className={ESTADO_UNIDAD_META[unidad.estado]?.clase}>●</span>
          {unidad.notas && <span className="text-muted-foreground">{unidad.notas}</span>}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Unidad {unidad.codigo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="uc">Código</Label>
              <Input
                id="uc"
                value={codigo}
                className="h-11"
                onChange={(e) => setCodigo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_UNIDAD.map((e) => (
                    <SelectItem key={e} value={e}>
                      {ESTADO_UNIDAD_META[e].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {unidad.estado === "RENTADA" && estado !== "RENTADA" && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Esta unidad figura como rentada; normalmente su estado cambia solo al
              recoger la renta.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="un">Notas</Label>
            <Input
              id="un"
              value={notas}
              placeholder="bomba falla, manchado…"
              className="h-11"
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            className="h-11 w-full"
            disabled={pending}
            onClick={() =>
              ejecutar(
                () =>
                  editarUnidad(unidad.id, {
                    codigo,
                    estado: estado as (typeof ESTADOS_UNIDAD)[number],
                    notas: notas || null,
                  }),
                "Unidad guardada",
              )
            }
          >
            {pending ? "Guardando…" : "Guardar"}
          </Button>

          <Separator />

          {reportando ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="uf">Falla</Label>
                <Input
                  id="uf"
                  value={falla}
                  placeholder="No enciende el motor"
                  className="h-11"
                  onChange={(e) => setFalla(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ufc">Costo estimado (opcional)</Label>
                <Input
                  id="ufc"
                  type="number"
                  inputMode="numeric"
                  value={costoFalla === 0 ? "" : costoFalla}
                  placeholder="0"
                  className="h-11"
                  onChange={(e) => setCostoFalla(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
              <Button
                variant="outline"
                className="h-11 w-full"
                disabled={pending}
                onClick={() =>
                  ejecutar(
                    () =>
                      reportarMantenimiento(unidad.id, {
                        descripcion: falla,
                        costo: costoFalla > 0 ? costoFalla : null,
                      }),
                    "Falla reportada",
                  )
                }
              >
                {pending ? "Reportando…" : "Reportar y mandar a mantenimiento"}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button
                variant="outline"
                className="h-11"
                onClick={() => setReportando(true)}
              >
                Reportar falla…
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 text-destructive"
                    aria-label="Eliminar unidad"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar la unidad {unidad.codigo}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Solo se puede eliminar si nunca ha tenido rentas (sus mantenimientos
                      también se borran). Si tiene historial, márcala como Baja.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="h-11 bg-destructive text-white hover:bg-destructive/90"
                      onClick={() =>
                        ejecutar(() => eliminarUnidad(unidad.id), "Unidad eliminada")
                      }
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Nueva unidad ----------
export function NuevaUnidadDialog({
  modeloId,
  modeloNombre,
  codigoSugerido,
}: {
  modeloId: string;
  modeloNombre: string;
  codigoSugerido: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState(codigoSugerido);
  const [notas, setNotas] = useState("");
  const { pending, error, ejecutar } = useAccion(() => setAbierto(false));

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) {
          setCodigo(codigoSugerido);
          setNotas("");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
        >
          <Plus className="size-3" /> unidad
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva unidad · {modeloNombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nuc">Código</Label>
            <Input
              id="nuc"
              value={codigo}
              className="h-11"
              onChange={(e) => setCodigo(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nun">Notas (opcional)</Label>
            <Input
              id="nun"
              value={notas}
              className="h-11"
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            className="h-11 w-full"
            disabled={pending}
            onClick={() =>
              ejecutar(
                () => crearUnidad(modeloId, { codigo, notas: notas || null }),
                "Unidad creada",
              )
            }
          >
            {pending ? "Creando…" : "Crear unidad"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Administrar accesorios (estados de tambos + eliminar) ----------
type AccesorioItem = {
  id: string;
  tipo: string;
  descripcion: string;
  codigo: string | null;
  estadoTambo: string | null;
};

const TITULO_TIPO: Record<string, string> = {
  MANGUERA: "Mangueras",
  EXTENSION: "Extensiones",
  TAMBO_GAS: "Tambos de gas",
};

export function AccesoriosDialog({ accesorios }: { accesorios: AccesorioItem[] }) {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Dos taps para eliminar: el primero pide confirmación en la misma fila.
  const [confirmando, setConfirmando] = useState<string | null>(null);

  function ejecutar(
    fn: () => Promise<InventarioActionResult>,
    mensajeExito?: string,
  ) {
    setError(null);
    start(async () => {
      const res = await fn();
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        if (mensajeExito) toast.success(mensajeExito);
        router.refresh();
      }
    });
  }

  const grupos = Object.entries(TITULO_TIPO)
    .map(([tipo, titulo]) => ({
      titulo,
      items: accesorios.filter((a) => a.tipo === tipo),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        setError(null);
        setConfirmando(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Pencil className="size-3.5" /> Administrar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Accesorios</DialogTitle>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className={"space-y-4" + (pending ? " opacity-60" : "")}>
          {grupos.map((g) => (
            <div key={g.titulo} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{g.titulo}</p>
              {g.items.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {a.codigo ?? a.descripcion}
                  </span>
                  {a.tipo === "TAMBO_GAS" && (
                    <div className="flex rounded-md border">
                      {ESTADOS_TAMBO.map((e, i) => (
                        <button
                          key={e.v}
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            ejecutar(() => cambiarEstadoTambo(a.id, e.v), "Tambo actualizado")
                          }
                          className={
                            "px-2.5 py-1.5 text-xs font-medium transition-colors " +
                            (i > 0 ? "border-l " : "") +
                            (a.estadoTambo === e.v
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted")
                          }
                        >
                          {e.l}
                        </button>
                      ))}
                    </div>
                  )}
                  {confirmando === a.id ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 shrink-0"
                      disabled={pending}
                      onClick={() => {
                        setConfirmando(null);
                        ejecutar(() => eliminarAccesorio(a.id), "Accesorio eliminado");
                      }}
                    >
                      ¿Eliminar?
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Eliminar ${a.codigo ?? a.descripcion}`}
                      disabled={pending}
                      onClick={() => setConfirmando(a.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Solo se pueden eliminar accesorios sin rentas asociadas.
        </p>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Nuevo accesorio ----------
export function NuevoAccesorioDialog() {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<(typeof TIPOS_ACCESORIO)[number]["v"]>("MANGUERA");
  const [descripcion, setDescripcion] = useState("");
  const [codigo, setCodigo] = useState("");
  const { pending, error, ejecutar } = useAccion(() => setAbierto(false));

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) {
          setDescripcion("");
          setCodigo("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Plus className="size-3.5" /> Accesorio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo accesorio</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_ACCESORIO.map((t) => (
                  <SelectItem key={t.v} value={t.v}>
                    {t.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nad">Descripción</Label>
            <Input
              id="nad"
              value={descripcion}
              placeholder="Manguera 10m, Extensión 15m, Tambo gas 20kg #15…"
              className="h-11"
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nac">Código (opcional)</Label>
            <Input
              id="nac"
              value={codigo}
              placeholder="MG-07, EXT-10-4, TAMBO-15…"
              className="h-11"
              onChange={(e) => setCodigo(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            className="h-11 w-full"
            disabled={pending}
            onClick={() =>
              ejecutar(
                () => crearAccesorio({ tipo, descripcion, codigo: codigo || null }),
                "Accesorio creado",
              )
            }
          >
            {pending ? "Creando…" : "Crear accesorio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Resolver mantenimiento ----------
export function ResolverMantenimientoButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await resolverMantenimiento(id);
          if ("error" in res) toast.error(res.error);
          else {
            toast.success("Mantenimiento resuelto");
            router.refresh();
          }
        })
      }
    >
      <Check className="size-3.5" /> {pending ? "…" : "Resuelto"}
    </Button>
  );
}
