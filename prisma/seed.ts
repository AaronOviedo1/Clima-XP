import {
  PrismaClient,
  Prisma,
  TipoEquipo,
  TipoAccesorio,
  EstadoTambo,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---------- Usuarios ----------
async function seedUsuarios() {
  const usuarios = [
    {
      nombre: "Administrador",
      email: process.env.ADMIN_EMAIL ?? "admin@climaxpress.mx",
      password: process.env.ADMIN_PASSWORD ?? "admin1234",
      rol: "ADMIN" as const,
    },
    {
      nombre: "Repartidor",
      email: process.env.REPARTIDOR_EMAIL ?? "repartidor@climaxpress.mx",
      password: process.env.REPARTIDOR_PASSWORD ?? "repartidor1234",
      rol: "REPARTIDOR" as const,
    },
  ];

  for (const u of usuarios) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { nombre: u.nombre, rol: u.rol },
      create: {
        nombre: u.nombre,
        email: u.email,
        passwordHash,
        rol: u.rol,
      },
    });
    console.log(`✔ Usuario ${u.rol}: ${u.email}`);
  }
}

// ---------- Modelos de equipo + unidades ----------
// specs viene del archivo INVENTARIO CLIMAXPRESS.
type ModeloSeed = {
  nombre: string;
  tipo: TipoEquipo;
  precioDia: number;
  precioDia3Mas?: number;
  prefijo: string; // prefijo de código de unidad, ej. "EF"
  cantidad: number; // cuántas unidades físicas crear
  specs: Prisma.InputJsonObject;
  // Colores por unidad (calentones): se asignan en orden a las unidades.
  colores?: { color: string; cantidad: number }[];
};

const MODELOS: ModeloSeed[] = [
  {
    nombre: "Eco-Fresco",
    tipo: TipoEquipo.AEROCOOLER,
    precioDia: 450,
    prefijo: "EF",
    cantidad: 6, // EF-01…EF-06
    specs: {
      flujoAire: "3600 CFM",
      areaEnfriamiento: "35 a 40 m²",
      ruido: "N/A",
      peso: "18 kg",
      potenciaMotor: "149.2 W",
      capacidadAgua: "40 L",
      dimensiones: "95 x 61 x 41 cm",
      voltaje: "127 V / 60 Hz",
    },
  },
  {
    nombre: "Turbo-Frío",
    tipo: TipoEquipo.AEROCOOLER,
    precioDia: 650,
    prefijo: "TF",
    cantidad: 2, // TF-01, TF-02
    specs: {
      flujoAire: "5300 CFM",
      areaEnfriamiento: "70 m²",
      ruido: "60 dB(A)",
      peso: "38 kg",
      potenciaMotor: "400 W",
      capacidadAgua: "55 L",
      dimensiones: "138 x 87 x 48 cm",
      voltaje: "127 V / 60 Hz",
    },
  },
  {
    nombre: "Chispas-Frescas",
    tipo: TipoEquipo.AEROCOOLER,
    precioDia: 550,
    prefijo: "CF",
    cantidad: 0, // actualmente 0 unidades
    specs: {
      flujoAire: "2680 CFM",
      areaEnfriamiento: "45 m²",
      ruido: "50 dB(A)",
      peso: "19 kg",
      potenciaMotor: "216 W",
      capacidadAgua: "50 L",
      dimensiones: "124 x 68 x 45.5 cm",
      voltaje: "127 V / 60 Hz",
    },
  },
  {
    nombre: "Fire Sense Café",
    tipo: TipoEquipo.CALENTON,
    precioDia: 550,
    precioDia3Mas: 495, // 3+ calentones
    prefijo: "CAL",
    cantidad: 20, // CAL-01…CAL-20
    colores: [
      { color: "Café Obscuro", cantidad: 7 },
      { color: "Gris Claro", cantidad: 8 },
      { color: "Café Gratinado", cantidad: 5 },
    ],
    specs: {
      marca: "Fire Sense",
      areaQueCalienta: "20 a 30 m²",
      gas: "20 kg / $200",
      dimensiones: { altura: "232 cm", casco: "76 a 88 cm", base: "45 a 50 cm" },
      variantes: [
        { color: "Café Obscuro", cantidad: 7, marca: "Fire Sense", peso: "16.7 kg", material: "Acero" },
        { color: "Gris Claro", cantidad: 8, marca: "Fire Sense", peso: "16.7 kg", material: "Acero" },
        { color: "Café Gratinado", cantidad: 5, marca: "N/A", peso: "22 kg", material: "Metal", altura: "1.7 a 2 m" },
      ],
    },
  },
];

async function seedModelosYUnidades() {
  for (const m of MODELOS) {
    const modelo = await prisma.modeloEquipo.upsert({
      where: { nombre: m.nombre },
      update: { tipo: m.tipo, precioDia: m.precioDia, precioDia3Mas: m.precioDia3Mas ?? null, specs: m.specs },
      create: {
        nombre: m.nombre,
        tipo: m.tipo,
        precioDia: m.precioDia,
        precioDia3Mas: m.precioDia3Mas ?? null,
        specs: m.specs,
      },
    });
    console.log(
      `✔ Modelo ${m.nombre} (${m.tipo}) $${m.precioDia}/día` +
        (m.precioDia3Mas ? ` · 3+: $${m.precioDia3Mas}` : ""),
    );

    // Color por unidad (según INVENTARIO): se asigna en orden a las unidades.
    const coloresPorUnidad: (string | null)[] = [];
    for (const c of m.colores ?? []) {
      for (let k = 0; k < c.cantidad; k++) coloresPorUnidad.push(c.color);
    }

    for (let i = 1; i <= m.cantidad; i++) {
      const codigo = `${m.prefijo}-${String(i).padStart(2, "0")}`;
      const color = coloresPorUnidad[i - 1] ?? null;
      const existente = await prisma.unidad.findUnique({ where: { codigo }, select: { id: true, notas: true } });
      if (existente) {
        // No pisa notas manuales; solo asigna color si estaba vacío o ya era un color.
        const puedeSetColor =
          color != null && (existente.notas == null || existente.notas.trim() === "" || existente.notas === color);
        await prisma.unidad.update({
          where: { id: existente.id },
          data: { modeloId: modelo.id, ...(puedeSetColor ? { notas: color } : {}) },
        });
      } else {
        await prisma.unidad.create({ data: { codigo, modeloId: modelo.id, notas: color } });
      }
    }
    if (m.cantidad > 0) {
      const detalleColor = m.colores ? ` (${m.colores.map((c) => `${c.cantidad} ${c.color}`).join(", ")})` : "";
      console.log(`  → ${m.cantidad} unidades (${m.prefijo}-01…${m.prefijo}-${String(m.cantidad).padStart(2, "0")})${detalleColor}`);
    }
  }
}

// ---------- Tarifa de domicilio por km ----------
// Precios reales del negocio: costo exacto por km (5–35 km). El modelo ZonaEnvio
// se usa como tabla de tarifa: kmMax = km, costo = precio de ese km.
// La sugerencia redondea la distancia hacia arriba al km más cercano.
const TARIFA_KM: Record<number, number> = {
  5: 89, 6: 105, 7: 122, 8: 139, 9: 157, 10: 174, 11: 192, 12: 209,
  13: 227, 14: 244, 15: 261, 16: 279, 17: 296, 18: 314, 19: 331, 20: 349,
  21: 366, 22: 383, 23: 401, 24: 418, 25: 436, 26: 453, 27: 471, 28: 488,
  29: 505, 30: 523, 31: 540, 32: 558, 33: 575, 34: 593, 35: 610,
};

async function seedZonas() {
  // Reemplaza cualquier tarifa previa (incluidas las "Zona 1…5" iniciales).
  await prisma.zonaEnvio.deleteMany({});
  const filas = Object.entries(TARIFA_KM).map(([km, costo]) => ({
    nombre: `${km} km`,
    kmMax: Number(km),
    costo,
  }));
  await prisma.zonaEnvio.createMany({ data: filas });
  console.log(`✔ Tarifa de domicilio: ${filas.length} tramos por km (5–35 km, $89–$610)`);
}

// ---------- Accesorios (según INVENTARIO CLIMAXPRESS) ----------
type AccesorioSeed = {
  codigo: string;
  tipo: TipoAccesorio;
  descripcion: string;
  estadoTambo?: EstadoTambo;
};

function construirAccesorios(): AccesorioSeed[] {
  const acc: AccesorioSeed[] = [];
  // Mangueras: 6 × 10m ($50 c/u)
  for (let i = 1; i <= 6; i++)
    acc.push({ codigo: `MG-${String(i).padStart(2, "0")}`, tipo: TipoAccesorio.MANGUERA, descripcion: "Manguera 10m" });
  // Extensiones: 2×5m, 3×10m, 2×15m, 1×45m
  const exts: [number, number][] = [[5, 2], [10, 3], [15, 2], [45, 1]];
  for (const [metros, cant] of exts)
    for (let i = 1; i <= cant; i++)
      acc.push({ codigo: `EXT-${metros}-${i}`, tipo: TipoAccesorio.EXTENSION, descripcion: `Extensión ${metros}m` });
  // Tambos de gas 20kg: 14
  for (let i = 1; i <= 14; i++)
    acc.push({ codigo: `TAMBO-${String(i).padStart(2, "0")}`, tipo: TipoAccesorio.TAMBO_GAS, descripcion: `Tambo gas 20kg #${i}`, estadoTambo: EstadoTambo.LLENO });
  return acc;
}

const ACCESORIOS = construirAccesorios();

async function seedAccesorios() {
  const referenciados = await prisma.rentaAccesorio.count();
  if (referenciados === 0) {
    // Reset limpio (no hay accesorios usados en rentas).
    await prisma.accesorio.deleteMany({});
    await prisma.accesorio.createMany({ data: ACCESORIOS });
  } else {
    for (const a of ACCESORIOS) {
      await prisma.accesorio.upsert({
        where: { codigo: a.codigo },
        update: { tipo: a.tipo, descripcion: a.descripcion, estadoTambo: a.estadoTambo ?? null },
        create: a,
      });
    }
  }
  console.log(`✔ ${ACCESORIOS.length} accesorios: 6 mangueras, 8 extensiones, 14 tambos`);
}

async function main() {
  await seedUsuarios();
  await seedModelosYUnidades();
  await seedZonas();
  await seedAccesorios();
  console.log("\n🌱 Seed completado.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
