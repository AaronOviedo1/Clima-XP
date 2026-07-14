import { Package, Droplets, Wrench, CheckCircle2, Cable, Flame } from "lucide-react";
import {
  datosInventario,
  conteoPorEstado,
  ESTADO_UNIDAD_META,
  SPEC_LABELS,
} from "@/lib/inventario";
import { pesos } from "@/lib/dinero";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AccesoriosDialog,
  NuevaUnidadDialog,
  NuevoAccesorioDialog,
  PreciosDialog,
  ResolverMantenimientoButton,
  UnidadDialog,
} from "@/components/inventario-acciones";

export const dynamic = "force-dynamic";

// Sugiere el siguiente código de unidad a partir de los existentes ("CAL-20" → "CAL-21").
function siguienteCodigo(codigos: string[], nombreModelo: string): string {
  let prefijo = "";
  let max = 0;
  let ancho = 2;
  for (const c of codigos) {
    const m = c.match(/^(.*?)(\d+)$/);
    if (!m) continue;
    const n = parseInt(m[2]);
    if (n > max) {
      max = n;
      prefijo = m[1];
      ancho = m[2].length;
    }
  }
  if (!prefijo) {
    prefijo =
      nombreModelo
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 3) + "-";
  }
  return `${prefijo}${String(max + 1).padStart(ancho, "0")}`;
}

function KPI({ icono, valor, label }: { icono: React.ReactNode; valor: number; label: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-0.5 py-3 text-center">
        <div className="text-muted-foreground">{icono}</div>
        <div className="text-2xl font-bold">{valor}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

// Renderiza el JSON de specs (strings, objeto dimensiones, array variantes).
function Specs({ specs }: { specs: unknown }) {
  if (!specs || typeof specs !== "object") return null;
  const obj = specs as Record<string, unknown>;
  const label = (k: string) => SPEC_LABELS[k] ?? k;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {Object.entries(obj).map(([k, v]) => {
        if (v == null) return null;
        if (k === "variantes" && Array.isArray(v)) return null; // se muestran aparte
        if (typeof v === "object") {
          const sub = Object.entries(v as Record<string, unknown>)
            .map(([sk, sv]) => `${label(sk)}: ${sv}`)
            .join(" · ");
          return (
            <div key={k} className="col-span-2 flex justify-between gap-2">
              <dt className="text-muted-foreground">{label(k)}</dt>
              <dd className="text-right">{sub}</dd>
            </div>
          );
        }
        return (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{label(k)}</dt>
            <dd className="text-right font-medium">{String(v)}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function Variantes({ specs }: { specs: unknown }) {
  const obj = specs as Record<string, unknown> | null;
  const variantes = obj && Array.isArray(obj.variantes) ? (obj.variantes as Record<string, unknown>[]) : null;
  if (!variantes) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Variantes</p>
      {variantes.map((v, i) => (
        <div key={i} className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
          <span className="font-medium">{String(v.color)}</span>
          <span className="text-muted-foreground">
            {String(v.cantidad)} u · {String(v.material)} · {String(v.peso)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function InventarioPage() {
  const { modelos, accesorios, mantenimientos, kpis } = await datosInventario();

  const aerocoolers = modelos.filter((m) => m.tipo === "AEROCOOLER");
  const calentones = modelos.filter((m) => m.tipo === "CALENTON");

  const mangueras = accesorios.filter((a) => a.tipo === "MANGUERA");
  const extensiones = accesorios.filter((a) => a.tipo === "EXTENSION");
  const tambos = accesorios.filter((a) => a.tipo === "TAMBO_GAS");

  const ModeloCard = ({ m }: { m: (typeof modelos)[number] }) => {
    const conteo = conteoPorEstado(m.unidades);
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{m.nombre}</CardTitle>
            <div className="flex items-start gap-1">
              <div className="text-right">
                <div className="font-semibold">{pesos(m.precioDia)}/día</div>
                {m.precioDia3Mas && (
                  <div className="text-xs text-muted-foreground">3+: {pesos(m.precioDia3Mas)}</div>
                )}
              </div>
              <PreciosDialog
                modelo={{
                  id: m.id,
                  nombre: m.nombre,
                  precioDia: m.precioDia,
                  precioDia3Mas: m.precioDia3Mas,
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline">{m.unidades.length} unidades</Badge>
            {Object.entries(conteo).map(([estado, n]) => (
              <Badge key={estado} variant={ESTADO_UNIDAD_META[estado]?.badge ?? "outline"}>
                {n} {ESTADO_UNIDAD_META[estado]?.label ?? estado}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Specs specs={m.specs} />
          <Variantes specs={m.specs} />
          <Separator />
          <div className="flex flex-wrap gap-1.5">
            {m.unidades.map((u) => (
              <UnidadDialog
                key={u.id}
                unidad={{ id: u.id, codigo: u.codigo, estado: u.estado, notas: u.notas }}
              />
            ))}
            <NuevaUnidadDialog
              modeloId={m.id}
              modeloNombre={m.nombre}
              codigoSugerido={siguienteCodigo(
                m.unidades.map((u) => u.codigo),
                m.nombre,
              )}
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>

      <div className="grid grid-cols-4 gap-2">
        <KPI icono={<Package className="size-5" />} valor={kpis.totalUnidades} label="Unidades" />
        <KPI icono={<CheckCircle2 className="size-5" />} valor={kpis.disponibles} label="Disponibles" />
        <KPI icono={<Wrench className="size-5" />} valor={kpis.enMantenimiento} label="En mant." />
        <KPI icono={<Droplets className="size-5" />} valor={kpis.tambosLlenos} label="Tambos" />
      </div>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Package className="size-5" /> Aerocoolers
        </h2>
        {aerocoolers.map((m) => (
          <ModeloCard key={m.id} m={m} />
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Flame className="size-5" /> Calentones
        </h2>
        {calentones.map((m) => (
          <ModeloCard key={m.id} m={m} />
        ))}
      </section>

      {/* Accesorios */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Cable className="size-5" /> Accesorios
          </h2>
          <div className="flex gap-2">
            <AccesoriosDialog
              accesorios={accesorios.map((a) => ({
                id: a.id,
                tipo: a.tipo,
                descripcion: a.descripcion,
                codigo: a.codigo,
                estadoTambo: a.estadoTambo,
              }))}
            />
            <NuevoAccesorioDialog />
          </div>
        </div>
        <Card>
          <CardContent className="space-y-3 py-4 text-sm">
            <div className="flex items-center justify-between">
              <span>Mangueras 10m</span>
              <Badge variant="secondary">{mangueras.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Extensiones</span>
              <span className="text-muted-foreground">
                {["5", "10", "15", "45"]
                  .map((metros) => {
                    const n = extensiones.filter((e) => e.descripcion.includes(`${metros}m`)).length;
                    return n ? `${n}×${metros}m` : null;
                  })
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1">
                <Droplets className="size-4" /> Tambos de gas 20kg
              </span>
              <span className="text-muted-foreground">
                {tambos.filter((t) => t.estadoTambo === "LLENO").length} llenos ·{" "}
                {tambos.filter((t) => t.estadoTambo === "VACIO").length} vacíos ·{" "}
                {tambos.filter((t) => t.estadoTambo === "EN_CLIENTE").length} en cliente
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Mantenimientos abiertos */}
      {mantenimientos.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Wrench className="size-5" /> Mantenimientos abiertos ({mantenimientos.length})
          </h2>
          <ul className="space-y-2">
            {mantenimientos.map((mt) => (
              <li key={mt.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-2 py-3 text-sm">
                    <div>
                      <span className="font-medium">{mt.unidad.codigo}</span>{" "}
                      <span className="text-muted-foreground">{mt.descripcion}</span>
                      {mt.costo != null && (
                        <span className="ml-1 text-muted-foreground">· {pesos(mt.costo)}</span>
                      )}
                    </div>
                    <ResolverMantenimientoButton id={mt.id} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
