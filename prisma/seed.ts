import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const admin = {
    nombre: "Administrador",
    email: process.env.ADMIN_EMAIL ?? "admin@climaxpress.mx",
    password: process.env.ADMIN_PASSWORD ?? "admin1234",
    rol: "ADMIN" as const,
  };
  const repartidor = {
    nombre: "Repartidor",
    email: process.env.REPARTIDOR_EMAIL ?? "repartidor@climaxpress.mx",
    password: process.env.REPARTIDOR_PASSWORD ?? "repartidor1234",
    rol: "REPARTIDOR" as const,
  };

  for (const u of [admin, repartidor]) {
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

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
