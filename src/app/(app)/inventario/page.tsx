import { Package, Droplets, Wrench, CheckCircle2, Cable, Flame, Wind, ChevronDown, AlertTriangle } from "lucide-react";
import {
  datosInventario,
  conteoPorEstado,
  ESTADO_UNIDAD_META,
  ORDEN_ESTADO_UNIDAD,
  SPEC_LABELS,
} from "@/lib/inventario";
import { pesos } from "@/lib/dinero";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import {
  AccesoriosDialog,
  NuevaUnidadDialog,
  NuevoAccesorioDialog,
  PreciosDialog,
  ResolverMantenimientoButton,
  UnidadDialog,
} from "@/components/inventario-acciones";
import { EdicionMasivaDialog } from "@/components/inventario-masivo";
import {
  AccionesSeccion,
  CLASE_ACCION_TOP_BAR,
  SubtituloSeccion,
} from "@/components/desktop/seccion";

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

function KPI({
  icono,
  valor,
  label,
  bg,
  fg,
}: {
  icono: React.ReactNode;
  valor: number;
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <Card className="p-[18px]">
      <div className="flex items-center gap-3.5">
        <div
          className="flex size-[42px] shrink-0 items-center justify-center rounded-xl"
          style={{ background: bg, color: fg }}
        >
          {icono}
        </div>
        <div>
          <div className="text-2xl leading-none font-extrabold tabular-nums">
            {valor}
          </div>
          <div className="mt-1 text-[12.5px] font-semibold text-muted-foreground">
            {label}
          </div>
        </div>
      </div>
    </Card>
  );
}

// Renderiza el JSON de specs (strings, objeto dimensiones, array variantes).
function Specs({ specs }: { specs: unknown }) {
  if (!specs || typeof specs !== "object") return null;
  const obj = specs as Record<string, unknown>;
  const label = (k: string) => SPEC_LABELS[k] ?? k;

  return (
    <dl className="grid grid-cols-2 gap-x-7 gap-y-2 text-sm">
      {Object.entries(obj).map(([k, v]) => {
        if (v == null) return null;
        if (k === "variantes" && Array.isArray(v)) return null; // se muestran aparte
        if (typeof v === "object") {
          const sub = Object.entries(v as Record<string, unknown>)
            .map(([sk, sv]) => `${label(sk)}: ${sv}`)
            .join(" · ");
          return (
            <div key={k} className="col-span-2 flex justify-between gap-2">
              <dt className="text-tenue">{label(k)}</dt>
              <dd className="text-right font-bold">{sub}</dd>
            </div>
          );
        }
        return (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-tenue">{label(k)}</dt>
            <dd className="text-right font-bold">{String(v)}</dd>
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

// Fila de la tarjeta de accesorios (escritorio): concepto a la izquierda, el
// desglose a la derecha ("9 llenos · 3 vacíos · 2 en cliente").
function FilaAccesorio({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t px-[18px] py-3.5 text-sm">
      <span className="font-bold">{titulo}</span>
      <span className="text-right text-tenue">{valor}</span>
    </div>
  );
}

// KPI móvil: número grande de color + etiqueta, sin ícono (estilo iOS del mockup).
function KpiMovil({ valor, label, color }: { valor: number; label: string; color?: string }) {
  return (
    <Card className="items-center gap-1 py-4 text-center">
      <div className={`text-[26px] leading-none font-extrabold tabular-nums ${color ?? ""}`}>
        {valor}
      </div>
      <div className="text-[12px] font-semibold text-muted-foreground">{label}</div>
    </Card>
  );
}

const TIPO_LABEL: Record<string, string> = { AEROCOOLER: "Aerocooler", CALENTON: "Calentón" };

export default async function InventarioPage() {
  const { modelos, accesorios, mantenimientos, kpis } = await datosInventario();

  const aerocoolers = modelos.filter((m) => m.tipo === "AEROCOOLER");
  const calentones = modelos.filter((m) => m.tipo === "CALENTON");

  const mangueras = accesorios.filter((a) => a.tipo === "MANGUERA");
  const extensiones = accesorios.filter((a) => a.tipo === "EXTENSION");
  const tambos = accesorios.filter((a) => a.tipo === "TAMBO_GAS");

  const ModeloCard = ({ m }: { m: (typeof modelos)[number] }) => {
    const conteo = conteoPorEstado(m.unidades);
    const esAero = m.tipo === "AEROCOOLER";
    return (
      <Card className="group gap-0 py-0">
        <div className="space-y-3.5 p-[18px]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {/* Barrita del tipo: azul aerocooler, naranja calentón. */}
              <span
                className="h-[22px] w-[5px] shrink-0 rounded-full"
                style={{ background: esAero ? "var(--primary)" : "var(--calenton)" }}
              />
              <h3 className="truncate text-[19px] leading-tight font-extrabold tracking-tight">
                {m.nombre}
              </h3>
            </div>
            <div className="flex shrink-0 items-start gap-1">
              <div className="text-right">
                <div className="text-[17px] leading-tight font-extrabold tabular-nums">
                  {pesos(m.precioDia)}/día
                </div>
                {m.precioDia3Mas && (
                  <div className="text-[13px] font-semibold text-tenue tabular-nums">
                    3+: {pesos(m.precioDia3Mas)}
                  </div>
                )}
              </div>
              {/* El lápiz solo aparece al pasar por la tarjeta: el mockup no lo
                  muestra, pero editar precios se hace desde aquí. */}
              <div className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground tabular-nums">
              {m.unidades.length} u
            </span>
            {ORDEN_ESTADO_UNIDAD.filter((e) => conteo[e]).map((estado) => (
              <span
                key={estado}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums",
                  ESTADO_UNIDAD_META[estado].chip,
                )}
              >
                {conteo[estado]} {ESTADO_UNIDAD_META[estado].corto}
              </span>
            ))}
          </div>

          <Specs specs={m.specs} />
          <Variantes specs={m.specs} />
        </div>

        <div className="flex flex-wrap gap-2 border-t p-[18px]">
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
      </Card>
    );
  };

  // Tarjeta de modelo móvil (mockup iOS): nombre, tipo · precio, X/Y disponibles y
  // barra de progreso; se expande para gestionar unidades y precios.
  const ModeloCardMovil = ({ m }: { m: (typeof modelos)[number] }) => {
    const total = m.unidades.length;
    const disp = m.unidades.filter((u) => u.estado === "DISPONIBLE").length;
    const pct = total ? Math.round((disp / total) * 100) : 0;
    const esAero = m.tipo === "AEROCOOLER";
    return (
      <Card className="gap-0 py-0">
        <details className="group">
          <summary className="flex cursor-pointer list-none flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[17px] leading-tight font-bold">{m.nombre}</div>
                <div className="mt-0.5 text-[13px] font-medium text-muted-foreground">
                  {TIPO_LABEL[m.tipo] ?? m.tipo} · {pesos(m.precioDia)}/día
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="leading-none">
                  <span className="text-xl font-extrabold tabular-nums">{disp}</span>
                  <span className="text-base font-semibold text-muted-foreground">/{total}</span>
                </div>
                <div className="mt-0.5 text-[11.5px] font-medium text-muted-foreground">
                  disponibles
                </div>
              </div>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: esAero ? "var(--primary)" : "var(--calenton)" }}
              />
            </div>
          </summary>
          <div className="space-y-3 border-t px-4 pt-3 pb-4">
            <Specs specs={m.specs} />
            <Variantes specs={m.specs} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-muted-foreground">
                {m.precioDia3Mas ? `3+: ${pesos(m.precioDia3Mas)}` : "Precios"}
              </span>
              <PreciosDialog
                modelo={{
                  id: m.id,
                  nombre: m.nombre,
                  precioDia: m.precioDia,
                  precioDia3Mas: m.precioDia3Mas,
                }}
              />
            </div>
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
          </div>
        </details>
      </Card>
    );
  };

  const codigosMantenimiento = mantenimientos.map((mt) => mt.unidad.codigo);

  // Unidades de todos los modelos, para la selección múltiple del pop-up masivo.
  const modelosMasivo = modelos.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    unidades: m.unidades.map((u) => ({
      id: u.id,
      codigo: u.codigo,
      estado: u.estado,
      notas: u.notas,
    })),
  }));

  return (
    <>
      {/* ---------- MÓVIL (estilo iOS del mockup) ---------- */}
      <div className="space-y-6 lg:hidden">
        <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em]">Inventario</h1>

        <div className="grid grid-cols-3 gap-3">
          <KpiMovil valor={kpis.totalUnidades} label="Unidades" />
          <KpiMovil valor={kpis.disponibles} label="Disponibles" color="text-emerald-600 dark:text-emerald-500" />
          <KpiMovil valor={kpis.rentadas} label="Rentadas" color="text-calenton" />
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              Modelos
            </h2>
            <EdicionMasivaDialog modelos={modelosMasivo} />
          </div>
          {modelos.map((m) => (
            <ModeloCardMovil key={m.id} m={m} />
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              Accesorios
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
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chip-azul text-chip-azul-fg">
                <Cable className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">Mangueras 10 m</div>
                <div className="text-[13px] text-muted-foreground">Conexión de agua</div>
              </div>
              <div className="text-xl font-extrabold tabular-nums">{mangueras.length}</div>
            </div>
            <div className="flex items-center gap-3 border-t p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chip-cielo text-chip-cielo-fg">
                <Cable className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">Extensiones</div>
                <div className="text-[13px] text-muted-foreground">
                  {["5", "10", "15", "45"]
                    .map((metros) => {
                      const n = extensiones.filter((e) => e.descripcion.includes(`${metros}m`)).length;
                      return n ? `${n}×${metros}m` : null;
                    })
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
              <div className="text-xl font-extrabold tabular-nums">{extensiones.length}</div>
            </div>
            <div className="flex items-center gap-3 border-t p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chip-rojo text-chip-rojo-fg">
                <Droplets className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">Tambos de gas 20 kg</div>
                <div className="text-[13px] text-muted-foreground">
                  {tambos.filter((t) => t.estadoTambo === "LLENO").length} llenos ·{" "}
                  {tambos.filter((t) => t.estadoTambo === "VACIO").length} vacíos ·{" "}
                  {tambos.filter((t) => t.estadoTambo === "EN_CLIENTE").length} en cliente
                </div>
              </div>
              <div className="text-xl font-extrabold tabular-nums">{tambos.length}</div>
            </div>
          </Card>
        </section>

        {mantenimientos.length > 0 && (
          <section className="space-y-3">
            <Card className="gap-0 py-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-chip-rojo text-chip-rojo-fg">
                    <AlertTriangle className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold">
                      {mantenimientos.length} en mantenimiento
                    </div>
                    <div className="truncate text-[13px] text-muted-foreground">
                      {codigosMantenimiento.join(" · ")}
                    </div>
                  </div>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <ul className="border-t">
                  {mantenimientos.map((mt) => (
                    <li
                      key={mt.id}
                      className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm first:border-t-0"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold">{mt.unidad.codigo}</span>{" "}
                        <span className="text-muted-foreground">{mt.descripcion}</span>
                        {mt.costo != null && (
                          <span className="ml-1 text-muted-foreground">· {pesos(mt.costo)}</span>
                        )}
                      </div>
                      <ResolverMantenimientoButton id={mt.id} />
                    </li>
                  ))}
                </ul>
              </details>
            </Card>
          </section>
        )}
      </div>

      {/* ---------- ESCRITORIO ---------- */}
      <div className="hidden space-y-6 lg:block">
        {/* El TopBar cuenta lo que hay: "28 unidades · 4 modelos". */}
        <SubtituloSeccion
          texto={`${kpis.totalUnidades} ${kpis.totalUnidades === 1 ? "unidad" : "unidades"} · ${modelos.length} ${modelos.length === 1 ? "modelo" : "modelos"}`}
        />
        {/* Y la edición masiva vive en el navbar, junto a "Nueva renta". */}
        <AccionesSeccion>
          <EdicionMasivaDialog
            modelos={modelosMasivo}
            triggerClassName={CLASE_ACCION_TOP_BAR}
          />
        </AccionesSeccion>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPI icono={<Package className="size-5" />} valor={kpis.totalUnidades} label="Unidades" bg="var(--chip-azul)" fg="var(--chip-azul-fg)" />
          <KPI icono={<CheckCircle2 className="size-5" />} valor={kpis.disponibles} label="Disponibles" bg="var(--chip-verde)" fg="var(--chip-verde-fg)" />
          <KPI icono={<Wrench className="size-5" />} valor={kpis.enMantenimiento} label="En mantenimiento" bg="var(--chip-ambar)" fg="var(--chip-ambar-fg)" />
          <KPI icono={<Droplets className="size-5" />} valor={kpis.tambosLlenos} label="Tambos llenos" bg="var(--chip-cielo)" fg="var(--chip-cielo-fg)" />
        </div>

        <section className="space-y-3.5">
          <h2 className="flex items-center gap-2.5 text-[19px] font-extrabold tracking-tight">
            <Wind className="size-5 text-primary" /> Aerocoolers
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {aerocoolers.map((m) => (
              <ModeloCard key={m.id} m={m} />
            ))}
          </div>
        </section>

        <section className="space-y-3.5">
          <h2 className="flex items-center gap-2.5 text-[19px] font-extrabold tracking-tight">
            <Flame className="size-5 text-calenton" /> Calentones
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {calentones.map((m) => (
              <ModeloCard key={m.id} m={m} />
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          {/* Accesorios */}
          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between gap-2 p-[18px] pb-3.5">
              <h2 className="flex items-center gap-2.5 text-[17px] font-extrabold tracking-tight">
                <Cable className="size-[18px] text-primary" /> Accesorios
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
            <FilaAccesorio
              titulo="Mangueras 10 m"
              valor={`${mangueras.length} ${mangueras.length === 1 ? "unidad" : "unidades"}`}
            />
            <FilaAccesorio
              titulo="Extensiones"
              valor={
                ["5", "10", "15", "45"]
                  .map((metros) => {
                    const n = extensiones.filter((e) => e.descripcion.includes(`${metros}m`)).length;
                    return n ? `${n}×${metros}m` : null;
                  })
                  .filter(Boolean)
                  .join(" · ") || "—"
              }
            />
            <FilaAccesorio
              titulo="Tambos de gas 20 kg"
              valor={`${tambos.filter((t) => t.estadoTambo === "LLENO").length} llenos · ${
                tambos.filter((t) => t.estadoTambo === "VACIO").length
              } vacíos · ${tambos.filter((t) => t.estadoTambo === "EN_CLIENTE").length} en cliente`}
            />
          </Card>

          {/* Mantenimientos abiertos: en ámbar, para que el taller salte a la vista. */}
          <Card className="gap-0 border-chip-ambar-fg/25 py-0">
            <h2 className="flex items-center gap-2.5 p-[18px] pb-3.5 text-[17px] font-extrabold tracking-tight text-chip-ambar-fg">
              <Wrench className="size-[18px]" /> Mantenimientos abiertos
              {mantenimientos.length > 0 && ` · ${mantenimientos.length}`}
            </h2>
            {mantenimientos.length === 0 ? (
              <p className="px-[18px] pb-[18px] text-sm text-muted-foreground">
                Ninguna unidad en el taller.
              </p>
            ) : (
              <ul className="space-y-2.5 px-[18px] pb-[18px]">
                {mantenimientos.map((mt) => (
                  <li
                    key={mt.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-chip-ambar px-3.5 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-extrabold text-chip-ambar-fg">
                        {mt.unidad.codigo}
                      </span>{" "}
                      <span className="text-foreground/80">{mt.descripcion}</span>
                      {mt.costo != null && (
                        <span className="text-foreground/80"> · {pesos(mt.costo)}</span>
                      )}
                    </div>
                    <ResolverMantenimientoButton
                      id={mt.id}
                      texto="Resolver"
                      conIcono={false}
                      className="shrink-0 border-transparent bg-taller font-bold text-taller-fg hover:bg-taller hover:text-taller-fg hover:brightness-110"
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
