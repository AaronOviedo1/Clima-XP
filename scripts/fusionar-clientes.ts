/**
 * Fusiona clientes duplicados: mueve las rentas de los duplicados al cliente
 * que se queda y borra los duplicados.
 *
 * Pasa siempre por acá cuando el mismo cliente quedó capturado dos veces (lada
 * equivocada, nombre escrito distinto, un dígito de más): borrar el duplicado a
 * mano dejaría sus rentas huérfanas, y Postgres ni siquiera lo permite — la
 * llave foránea de Renta lo impide.
 *
 * A cada cliente se le apunta por teléfono (en cualquier formato) o por id. El
 * teléfono no es único en el schema, así que si uno solo señala a varios
 * clientes se pide desambiguar con el id.
 *
 * Uso:
 *   npx tsx scripts/fusionar-clientes.ts <destino> <duplicado…>            # dry-run
 *   npx tsx scripts/fusionar-clientes.ts <destino> <duplicado…> --commit   # aplica
 *
 * Ejemplos:
 *   npx tsx scripts/fusionar-clientes.ts "662 123 4567" "663 123 4567"
 *   npx tsx scripts/fusionar-clientes.ts cmxxxx… cmyyyy… cmzzzz… --commit
 */
import { PrismaClient } from "@prisma/client";
import { normalizarTelefono, formatoTelefono } from "../src/lib/telefono";

// DIRECT_URL (5432): el pooler no es para transacciones largas de scripts.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
});

type ClienteConRentas = {
  id: string;
  nombre: string;
  telefono: string | null;
  notas: string | null;
  _count: { rentas: number };
};

const seleccion = {
  id: true,
  nombre: true,
  telefono: true,
  notas: true,
  _count: { select: { rentas: true } },
} as const;

/** Resuelve un argumento (teléfono en cualquier formato, o id) a clientes. */
async function buscar(arg: string): Promise<ClienteConRentas[]> {
  const tel = normalizarTelefono(arg);
  if (tel) return prisma.cliente.findMany({ where: { telefono: tel }, select: seleccion });
  const porId = await prisma.cliente.findUnique({ where: { id: arg }, select: seleccion });
  return porId ? [porId] : [];
}

function describir(c: ClienteConRentas): string {
  const tel = c.telefono ? formatoTelefono(c.telefono) : "sin teléfono";
  return `${c.nombre} · ${tel} · ${c.id} (${c._count.rentas} rentas)`;
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const refs = args.filter((a) => a !== "--commit");

  if (refs.length < 2) {
    console.error(
      "\nUso: npx tsx scripts/fusionar-clientes.ts <destino> <duplicado…> [--commit]" +
        "\n     El primero es el cliente que se queda; los demás se fusionan en él.\n",
    );
    process.exit(1);
  }

  const [refDestino, ...refsDuplicados] = refs;

  const candidatos = await buscar(refDestino);
  if (candidatos.length === 0) throw new Error(`No encontré ningún cliente con "${refDestino}".`);
  if (candidatos.length > 1) {
    console.error(`\n"${refDestino}" señala a ${candidatos.length} clientes:`);
    for (const c of candidatos) console.error(`  - ${describir(c)}`);
    throw new Error("El destino tiene que ser uno solo: vuelve a correrlo con su id.");
  }
  const destino = candidatos[0];

  // Un mismo teléfono puede señalar a varios duplicados: es justo el caso que
  // se viene a arreglar, así que se toman todos. El destino nunca se fusiona
  // consigo mismo, aunque comparta el número.
  const duplicados: ClienteConRentas[] = [];
  for (const ref of refsDuplicados) {
    const encontrados = await buscar(ref);
    if (encontrados.length === 0) throw new Error(`No encontré ningún cliente con "${ref}".`);
    for (const c of encontrados) {
      if (c.id === destino.id) continue;
      if (!duplicados.some((d) => d.id === c.id)) duplicados.push(c);
    }
  }

  console.log(`\nSe queda:  ${describir(destino)}`);
  if (duplicados.length === 0) {
    console.log("\nNo hay nada que fusionar: los duplicados ya no existen (o son el destino).\n");
    return;
  }
  console.log(`Se fusionan (${duplicados.length}):`);
  for (const d of duplicados) console.log(`  - ${describir(d)}`);

  // Datos que solo tiene el duplicado: se rescatan si el destino los trae
  // vacíos, y si no, se avisan en vez de borrarlos en silencio.
  const relleno: { telefono?: string; notas?: string } = {};
  if (!destino.telefono) {
    const conTel = duplicados.find((d) => d.telefono);
    if (conTel?.telefono) relleno.telefono = conTel.telefono;
  }
  if (!destino.notas) {
    const conNotas = duplicados.find((d) => d.notas?.trim());
    if (conNotas?.notas) relleno.notas = conNotas.notas;
  }
  if (Object.keys(relleno).length > 0) {
    console.log("\nSe copian al destino (los tenía vacíos):");
    for (const [campo, valor] of Object.entries(relleno)) console.log(`  ${campo}: ${valor}`);
  }
  const notasQueSePierden = duplicados
    .filter((d) => d.notas?.trim() && d.notas !== relleno.notas)
    .map((d) => `  ${d.nombre} (${d.id}): ${d.notas}`);
  if (notasQueSePierden.length > 0) {
    console.log("\n⚠ Notas que se van con los duplicados (cópialas antes si te sirven):");
    console.log(notasQueSePierden.join("\n"));
  }

  const totalRentas = duplicados.reduce((s, d) => s + d._count.rentas, 0);
  console.log(
    `\nSe moverían ${totalRentas} rentas y se borrarían ${duplicados.length} clientes.` +
      `\n"${destino.nombre}" quedaría con ${destino._count.rentas + totalRentas}.`,
  );

  if (!commit) {
    console.log("\n(dry-run) Nada se modificó. Corre otra vez con --commit para aplicar.\n");
    return;
  }

  const ids = duplicados.map((d) => d.id);
  const resultado = await prisma.$transaction(async (tx) => {
    const movidas = await tx.renta.updateMany({
      where: { clienteId: { in: ids } },
      data: { clienteId: destino.id },
    });
    if (Object.keys(relleno).length > 0)
      await tx.cliente.update({ where: { id: destino.id }, data: relleno });
    // Después del updateMany ya no les cuelga ninguna renta: la llave foránea
    // deja de estorbar y el borrado no pierde historial.
    const borrados = await tx.cliente.deleteMany({ where: { id: { in: ids } } });
    return { movidas: movidas.count, borrados: borrados.count };
  });

  const final = await prisma.cliente.findUnique({ where: { id: destino.id }, select: seleccion });
  console.log(`\n✓ Rentas movidas: ${resultado.movidas}`);
  console.log(`✓ Clientes borrados: ${resultado.borrados}`);
  console.log(`✓ Quedó: ${final ? describir(final) : "(no encontrado)"}\n`);
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
