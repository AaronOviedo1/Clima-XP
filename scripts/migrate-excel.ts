/**
 * Migración del Excel histórico → base de datos.
 *
 * Conservador: mapea columnas por nombre de encabezado (tolera variaciones de
 * layout entre hojas), infiere el año por temporada, y exporta las filas
 * ambiguas a un CSV de revisión. Idempotente: en modo --commit borra primero
 * las rentas migradas anteriormente (marcadas con ⟦mig⟧) y las reinserta.
 *
 * Uso:
 *   npx tsx scripts/migrate-excel.ts            # dry-run (solo CSV, no inserta)
 *   npx tsx scripts/migrate-excel.ts --commit   # inserta en la BD
 */
import * as fs from "node:fs";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { normalizarTelefono } from "@/lib/telefono";
import { parseCoordenadas } from "@/lib/coordenadas";
import { fechaDesdeInput, sumarDiasInput } from "@/lib/fechas";

// Usa la conexión directa (DIRECT_URL, 5432) para el batch: el pooler en modo
// transacción (6543) cierra conexiones en jobs largos secuenciales (P1017).
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
});
const COMMIT = process.argv.includes("--commit");
const ARCHIVO = "Registro_Rentas Climaxpress.xlsx";
const MARCADOR = "⟦mig⟧";

// Mes por prefijo de 3 letras (tolera typos: "diciebre", "sept", etc.).
const MESES_PREFIJO: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11,
};
function mesDesdeNombre(nombre: string): number | null {
  const n = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const p = n.slice(0, 3);
  return p in MESES_PREFIJO ? MESES_PREFIJO[p] : null;
}

// Extrae el primer teléfono válido de una cadena con posibles varios números.
function primerTelefono(raw: unknown): string | null {
  if (raw == null) return null;
  const partes = String(raw).split(/\s+[yYoO]\s+|[/;,&|]|\n/);
  for (const p of partes) {
    const t = normalizarTelefono(p);
    if (t) return t;
  }
  return normalizarTelefono(String(raw));
}

type SheetInfo = { tipo: "cooler" | "calenton"; años: number[] };
function infoHoja(nombre: string): SheetInfo {
  const n = nombre.toUpperCase();
  const tipo = /CLNTON|CALENT/.test(n) ? "calenton" : "cooler";
  const años = (nombre.match(/20\d{2}/g) ?? []).map(Number);
  return { tipo, años: años.length ? años : [new Date().getFullYear()] };
}

const norm = (s: unknown) => String(s ?? "").trim().toUpperCase();

function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Math.round(v);
  const s = String(v).replace(/[^0-9.-]/g, "");
  if (!s || s === "-" || s === ".") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseEntero(v: unknown): number {
  const n = parseMoney(v);
  return n && n > 0 ? n : 0;
}

// Fecha → "yyyy-mm-dd" | null. Infiere año por temporada para "D de MES".
function parseFecha(cell: unknown, info: SheetInfo): { iso: string | null; flag?: string } {
  if (cell == null) return { iso: null };

  if (cell instanceof Date) {
    const y = cell.getUTCFullYear();
    if (y < 2020 || y > 2030) return { iso: null, flag: "fecha-fuera-rango" };
    const iso = `${y}-${String(cell.getUTCMonth() + 1).padStart(2, "0")}-${String(cell.getUTCDate()).padStart(2, "0")}`;
    return { iso, flag: "fecha-tipo-date" };
  }

  const texto = String(cell).trim();

  // dd/mm/yy o dd/mm/yyyy
  const m1 = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m1) {
    const d = +m1[1], mo = +m1[2] - 1, yRaw = +m1[3];
    const y = yRaw < 100 ? 2000 + yRaw : yRaw;
    if (mo >= 0 && mo <= 11 && d >= 1 && d <= 31)
      return { iso: `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
  }

  // "D de MES" o "D MES"
  const m2 = texto.toLowerCase().match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóú]+)/i);
  if (m2) {
    const d = +m2[1];
    const mes = mesDesdeNombre(m2[2]);
    if (mes != null && d >= 1 && d <= 31) {
      let año = info.años[0];
      if (info.años.length > 1) {
        // Temporada de calentones: Oct–Dic → primer año, Ene–Sep → segundo.
        año = mes >= 9 ? info.años[0] : info.años[1];
      }
      return { iso: `${año}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
    }
  }

  return { iso: null, flag: "fecha-no-parseada" };
}

function limpiarNombre(v: unknown): string {
  return String(v ?? "")
    .replace(/^[~_"“”'`\s]+/, "")
    .replace(/["“”]+$/, "")
    .trim();
}

function mapMetodo(v: unknown): "EFECTIVO" | "TRANSFERENCIA" | "LINK_MERCADO_PAGO" | "OTRO" {
  const s = norm(v);
  if (/EFECTIVO/.test(s)) return "EFECTIVO";
  if (/TRANSFER|SPIN|DEPOSITO/.test(s)) return "TRANSFERENCIA";
  if (/LINK|MERCADO|MP\b/.test(s)) return "LINK_MERCADO_PAGO";
  return "OTRO";
}

const RE_CANCEL = /CANCEL|NO SE (RENT|HIZO|CONCRET)|SE CAY[OÓ]/;

type Fila = {
  hoja: string;
  fila: number;
  motivo: string[];
  fechaRaw: string;
  cliente: string;
  telefonoRaw: string;
  lugar: string;
  total: number | null;
  insertado: boolean;
  // datos ya parseados (si se inserta)
  data?: {
    fechaIso: string;
    dias: number;
    cliente: string;
    telefono: string | null;
    direccion: string;
    lat: number | null;
    lng: number | null;
    ventana: string | null;
    distanciaKm: number | null;
    eco: number;
    turbo: number;
    calenton: number;
    importe: number | null;
    domicilio: number;
    gas: number | null;
    total: number | null;
    metodo: "EFECTIVO" | "TRANSFERENCIA" | "LINK_MERCADO_PAGO" | "OTRO";
    cancelada: boolean;
    notas: string;
  };
};

function procesarHoja(wb: XLSX.WorkBook, nombre: string): Fila[] {
  const info = infoHoja(nombre);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre], {
    header: 1,
    blankrows: false,
    defval: null,
  });

  let h = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = (rows[i] as unknown[]).map(norm);
    if (r.includes("FECHA") && r.includes("CLIENTE")) { h = i; break; }
  }
  if (h < 0) return [];
  const hdr = (rows[h] as unknown[]).map(norm);
  const col = (n: string) => hdr.indexOf(n);

  const iFecha = col("FECHA"), iTel = col("NUMERO"), iCli = col("CLIENTE"),
    iLugar = col("LUGAR"), iHora = col("HORA ENTREGA"), iDist = col("DISTANCIA (KM)"),
    iEco = col("ECO-FRESCO"), iTurbo = col("TURBO-FRIO"), iDias = col("DIAS"),
    iCant = col("CANTIDAD"), iImporte = col("IMPORTE"), iGas = col("COSTO GAS"),
    iComision = col("COMISION 15%"), iDom = col("DOMICILIO"), iPago = col("FORMA DE PAGO"),
    iTotal = col("TOTAL"), iNotas = col("NOTAS"), iEvento = col("EVENTO");

  const salida: Fila[] = [];

  for (let i = h + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const cliRaw = row[iCli];
    if (cliRaw == null) continue;
    const cliNorm = norm(cliRaw);
    if (cliNorm === "TOTAL" || cliNorm === "--" || cliNorm === "") continue;

    const motivo: string[] = [];
    const fechaCell = row[iFecha];
    const { iso, flag } = parseFecha(fechaCell, info);
    if (flag) motivo.push(flag);

    const telefono = primerTelefono(row[iTel]);
    const telRaw = row[iTel] != null ? String(row[iTel]) : "";
    if (telRaw && !telefono) motivo.push("telefono-invalido");

    const cliente = limpiarNombre(cliRaw) || "Sin nombre";
    const lugar = String(row[iLugar] ?? "").trim();
    const coords = parseCoordenadas(lugar);

    const eco = iEco >= 0 ? parseEntero(row[iEco]) : 0;
    const turbo = iTurbo >= 0 ? parseEntero(row[iTurbo]) : 0;
    const calenton = iCant >= 0 ? parseEntero(row[iCant]) : 0;
    const dias = iDias >= 0 ? Math.max(1, parseEntero(row[iDias]) || 1) : 1;
    const importe = iImporte >= 0 ? parseMoney(row[iImporte]) : null;
    const domicilio = iDom >= 0 ? (parseMoney(row[iDom]) ?? 0) : 0;
    const gas = iGas >= 0 ? parseMoney(row[iGas]) : iComision >= 0 ? parseMoney(row[iComision]) : null;
    const total = iTotal >= 0 ? parseMoney(row[iTotal]) : null;
    const metodo = mapMetodo(row[iPago]);
    const distanciaKm = iDist >= 0 ? (typeof row[iDist] === "number" ? (row[iDist] as number) : null) : null;

    const ventana = iHora >= 0 && typeof row[iHora] === "string" ? String(row[iHora]).trim() : null;
    const evento = iEvento >= 0 && row[iEvento] ? String(row[iEvento]).trim() : "";
    const notasOrig = iNotas >= 0 && row[iNotas] ? String(row[iNotas]).trim() : "";
    const cancelada = RE_CANCEL.test(norm([notasOrig, cliente, ventana].join(" ")));

    const totalUnidades = eco + turbo + calenton;

    // Fila ambigua → no insertar
    let insertado = true;
    if (!iso) { insertado = false; }
    if (totalUnidades === 0 && (!total || total === 0)) {
      motivo.push("sin-equipos-ni-total");
      insertado = false;
    }

    const notasPartes = [
      notasOrig,
      evento && `Evento: ${evento}`,
      gas != null && gas > 0 && (iComision >= 0 ? `Comisión: $${gas}` : `Gas: $${gas}`),
      `Pago: ${metodo}`,
    ].filter(Boolean);

    salida.push({
      hoja: nombre,
      fila: i + 1,
      motivo,
      fechaRaw: fechaCell instanceof Date ? fechaCell.toISOString() : String(fechaCell ?? ""),
      cliente,
      telefonoRaw: telRaw,
      lugar,
      total,
      insertado,
      data: insertado && iso
        ? {
            fechaIso: iso, dias, cliente, telefono, direccion: lugar || "Sin dirección",
            lat: coords?.lat ?? null, lng: coords?.lng ?? null, ventana, distanciaKm,
            eco, turbo, calenton, importe, domicilio, gas, total, metodo, cancelada,
            notas: notasPartes.join(" · "),
          }
        : undefined,
    });
  }
  return salida;
}

async function main() {
  const wb = XLSX.readFile(ARCHIVO, { cellDates: true });
  const todas: Fila[] = [];
  for (const nombre of wb.SheetNames) todas.push(...procesarHoja(wb, nombre));

  const aInsertar = todas.filter((f) => f.insertado && f.data);
  const ambiguas = todas.filter((f) => !f.insertado || f.motivo.length);

  // CSV de revisión
  const csvHead = "hoja,fila,insertado,motivos,fecha_raw,cliente,telefono_raw,lugar,total\n";
  const csvBody = ambiguas
    .map((f) =>
      [f.hoja, f.fila, f.insertado ? "sí" : "NO", `"${f.motivo.join("; ")}"`,
       `"${f.fechaRaw}"`, `"${f.cliente}"`, `"${f.telefonoRaw}"`,
       `"${f.lugar.replace(/"/g, "'")}"`, f.total ?? ""].join(","),
    )
    .join("\n");
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/revision-migracion.csv", csvHead + csvBody + "\n");

  console.log("=== RESUMEN ===");
  console.log(`Filas totales (con cliente): ${todas.length}`);
  console.log(`A insertar: ${aInsertar.length}`);
  console.log(`Ambiguas / con aviso: ${ambiguas.length} (ver data/revision-migracion.csv)`);
  console.log(`  no insertadas: ${todas.filter((f) => !f.insertado).length}`);
  const motivoCount: Record<string, number> = {};
  for (const f of ambiguas) for (const m of f.motivo) motivoCount[m] = (motivoCount[m] ?? 0) + 1;
  console.log("  motivos:", motivoCount);

  if (!COMMIT) {
    console.log("\n(dry-run) No se insertó nada. Corre con --commit para insertar.");
    await prisma.$disconnect();
    return;
  }

  // --- Inserción ---
  const modelos = await prisma.modeloEquipo.findMany({ include: { unidades: { orderBy: { codigo: "asc" } } } });
  const byNombre = (n: string) => modelos.find((m) => m.nombre === n)!;
  const unidadesEco = byNombre("Eco-Fresco").unidades;
  const unidadesTurbo = byNombre("Turbo-Frío").unidades;
  const unidadesCal = byNombre("Fire Sense Café").unidades;
  const precioEco = byNombre("Eco-Fresco").precioDia;
  const precioTurbo = byNombre("Turbo-Frío").precioDia;
  const precioCal = byNombre("Fire Sense Café").precioDia;

  // Idempotencia: borrar rentas migradas previas.
  const previas = await prisma.renta.findMany({ where: { notas: { startsWith: MARCADOR } }, select: { id: true } });
  const ids = previas.map((r) => r.id);
  if (ids.length) {
    await prisma.pago.deleteMany({ where: { rentaId: { in: ids } } });
    await prisma.mensajeWhatsApp.deleteMany({ where: { rentaId: { in: ids } } });
    await prisma.renta.deleteMany({ where: { id: { in: ids } } });
    console.log(`\nBorradas ${ids.length} rentas migradas previas.`);
  }

  // Precargar clientes en memoria (evita un findFirst por fila).
  const existentes = await prisma.cliente.findMany({ select: { id: true, nombre: true, telefono: true } });
  const porTelefono = new Map<string, string>();
  const porNombre = new Map<string, string>();
  for (const c of existentes) {
    if (c.telefono) porTelefono.set(c.telefono, c.id);
    else porNombre.set(c.nombre.toLowerCase(), c.id);
  }
  async function resolverCliente(nombre: string, telefono: string | null): Promise<string> {
    if (telefono && porTelefono.has(telefono)) return porTelefono.get(telefono)!;
    if (!telefono && porNombre.has(nombre.toLowerCase())) return porNombre.get(nombre.toLowerCase())!;
    const c = await prisma.cliente.create({ data: { nombre, telefono, canalOrigen: "WHATSAPP" } });
    if (telefono) porTelefono.set(telefono, c.id);
    else porNombre.set(nombre.toLowerCase(), c.id);
    return c.id;
  }

  let insertadas = 0;
  for (const f of aInsertar) {
    const d = f.data!;
    const clienteId = await resolverCliente(d.cliente, d.telefono);

    // Unidades (cap a lo disponible por modelo).
    const items: { unidadId: string; precioDia: number }[] = [];
    unidadesEco.slice(0, Math.min(d.eco, unidadesEco.length)).forEach((u) => items.push({ unidadId: u.id, precioDia: precioEco }));
    unidadesTurbo.slice(0, Math.min(d.turbo, unidadesTurbo.length)).forEach((u) => items.push({ unidadId: u.id, precioDia: precioTurbo }));
    unidadesCal.slice(0, Math.min(d.calenton, unidadesCal.length)).forEach((u) => items.push({ unidadId: u.id, precioDia: precioCal }));

    const equipSubtotal = items.reduce((a, it) => a + it.precioDia * d.dias, 0);
    const base = equipSubtotal + d.domicilio;
    let descuentoMonto = 0;
    let descuentoNota: string | null = null;
    if (d.total != null && d.total < base) {
      descuentoMonto = base - d.total;
      descuentoNota = "ajuste migración (Excel)";
    }
    const totalApp = base - descuentoMonto;

    const fechaInicio = fechaDesdeInput(d.fechaIso);
    const fechaFin = fechaDesdeInput(sumarDiasInput(d.fechaIso, d.dias));
    const estado = d.cancelada ? "CANCELADA" : "CONCLUIDA";

    const notaTotal = d.total != null && d.total !== totalApp ? ` · Total Excel: $${d.total}` : "";

    await prisma.renta.create({
      data: {
        clienteId,
        estado,
        fechaInicio,
        fechaFin,
        ventanaEntrega: d.ventana,
        direccion: d.direccion,
        lat: d.lat,
        lng: d.lng,
        distanciaKm: d.distanciaKm,
        costoDomicilio: d.domicilio,
        descuentoMonto,
        descuentoNota,
        notas: `${MARCADOR} [${f.hoja}#${f.fila}] ${d.notas}${notaTotal}`.trim(),
        unidades: items.length ? { create: items } : undefined,
        pagos:
          estado === "CONCLUIDA" && totalApp > 0
            ? { create: { monto: totalApp, metodo: d.metodo, tipo: "LIQUIDACION", pagado: true } }
            : undefined,
      },
    });
    insertadas++;
  }

  console.log(`\n✔ Insertadas ${insertadas} rentas históricas.`);
  const clientes = await prisma.cliente.count();
  console.log(`Clientes totales en BD: ${clientes}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
