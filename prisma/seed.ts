import {
  PrismaClient,
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
type ModeloSeed = {
  nombre: string;
  tipo: TipoEquipo;
  precioDia: number;
  precioDia3Mas?: number;
  prefijo: string; // prefijo de código de unidad, ej. "EF"
  cantidad: number; // cuántas unidades físicas crear
};

const MODELOS: ModeloSeed[] = [
  {
    nombre: "Eco-Fresco",
    tipo: TipoEquipo.AEROCOOLER,
    precioDia: 450,
    prefijo: "EF",
    cantidad: 6, // EF-01…EF-06
  },
  {
    nombre: "Turbo-Frío",
    tipo: TipoEquipo.AEROCOOLER,
    precioDia: 650,
    prefijo: "TF",
    cantidad: 2, // TF-01, TF-02
  },
  {
    nombre: "Chispas-Frescas",
    tipo: TipoEquipo.AEROCOOLER,
    precioDia: 550,
    prefijo: "CF",
    cantidad: 0, // actualmente 0 unidades
  },
  {
    nombre: "Fire Sense Café",
    tipo: TipoEquipo.CALENTON,
    precioDia: 550,
    precioDia3Mas: 495, // 3+ calentones
    prefijo: "CAL",
    cantidad: 20, // CAL-01…CAL-20
  },
];

async function seedModelosYUnidades() {
  for (const m of MODELOS) {
    const modelo = await prisma.modeloEquipo.upsert({
      where: { nombre: m.nombre },
      update: { tipo: m.tipo, precioDia: m.precioDia, precioDia3Mas: m.precioDia3Mas ?? null },
      create: {
        nombre: m.nombre,
        tipo: m.tipo,
        precioDia: m.precioDia,
        precioDia3Mas: m.precioDia3Mas ?? null,
      },
    });
    console.log(
      `✔ Modelo ${m.nombre} (${m.tipo}) $${m.precioDia}/día` +
        (m.precioDia3Mas ? ` · 3+: $${m.precioDia3Mas}` : ""),
    );

    for (let i = 1; i <= m.cantidad; i++) {
      const codigo = `${m.prefijo}-${String(i).padStart(2, "0")}`;
      await prisma.unidad.upsert({
        where: { codigo },
        update: { modeloId: modelo.id },
        create: { codigo, modeloId: modelo.id },
      });
    }
    if (m.cantidad > 0) {
      console.log(`  → ${m.cantidad} unidades (${m.prefijo}-01…${m.prefijo}-${String(m.cantidad).padStart(2, "0")})`);
    }
  }
}

// ---------- Zonas de envío ----------
// Zona 1 (6km) … Zona 5 (35km), rango $50–$400. Costos editables en Configuración.
const ZONAS = [
  { nombre: "Zona 1", kmMax: 6, costo: 50 },
  { nombre: "Zona 2", kmMax: 15, costo: 150 },
  { nombre: "Zona 3", kmMax: 22, costo: 250 },
  { nombre: "Zona 4", kmMax: 28, costo: 350 },
  { nombre: "Zona 5", kmMax: 35, costo: 400 },
];

async function seedZonas() {
  for (const z of ZONAS) {
    await prisma.zonaEnvio.upsert({
      where: { nombre: z.nombre },
      update: { kmMax: z.kmMax, costo: z.costo },
      create: z,
    });
  }
  console.log(`✔ ${ZONAS.length} zonas de envío`);
}

// ---------- Accesorios ----------
const ACCESORIOS = [
  // Mangueras (10m)
  { codigo: "MG-01", tipo: TipoAccesorio.MANGUERA, descripcion: "Manguera 10m" },
  { codigo: "MG-02", tipo: TipoAccesorio.MANGUERA, descripcion: "Manguera 10m" },
  // Extensiones (5/10/15/45m)
  { codigo: "EXT-05", tipo: TipoAccesorio.EXTENSION, descripcion: "Extensión 5m" },
  { codigo: "EXT-10", tipo: TipoAccesorio.EXTENSION, descripcion: "Extensión 10m" },
  { codigo: "EXT-15", tipo: TipoAccesorio.EXTENSION, descripcion: "Extensión 15m" },
  { codigo: "EXT-45", tipo: TipoAccesorio.EXTENSION, descripcion: "Extensión 45m" },
  // Tambos de gas (20kg)
  { codigo: "TAMBO-01", tipo: TipoAccesorio.TAMBO_GAS, descripcion: "Tambo gas 20kg #1", estadoTambo: EstadoTambo.LLENO },
  { codigo: "TAMBO-02", tipo: TipoAccesorio.TAMBO_GAS, descripcion: "Tambo gas 20kg #2", estadoTambo: EstadoTambo.LLENO },
  { codigo: "TAMBO-03", tipo: TipoAccesorio.TAMBO_GAS, descripcion: "Tambo gas 20kg #3", estadoTambo: EstadoTambo.LLENO },
  { codigo: "TAMBO-04", tipo: TipoAccesorio.TAMBO_GAS, descripcion: "Tambo gas 20kg #4", estadoTambo: EstadoTambo.LLENO },
];

async function seedAccesorios() {
  for (const a of ACCESORIOS) {
    await prisma.accesorio.upsert({
      where: { codigo: a.codigo },
      update: { tipo: a.tipo, descripcion: a.descripcion, estadoTambo: a.estadoTambo ?? null },
      create: a,
    });
  }
  console.log(`✔ ${ACCESORIOS.length} accesorios (mangueras, extensiones, tambos)`);
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
