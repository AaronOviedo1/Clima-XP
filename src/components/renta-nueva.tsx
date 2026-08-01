import { prisma } from "@/lib/prisma";
import { hoyNegocio, sumarDiasInput } from "@/lib/fechas";
import { unidadesParaFechas } from "@/lib/actions/rentas";
import { AltaRenta } from "@/components/renta/alta-renta";

/**
 * Alta de renta: carga clientes y unidades disponibles y monta el flujo por
 * pasos. Vive siempre a pantalla completa (/rentas/nueva); el pop-up que había
 * antes se quitó al rediseñarla, porque un flujo de varios pasos dentro de una
 * ventana con scroll propio no funciona en el teléfono.
 */
export async function RentaNueva({
  clientePreseleccionado,
}: {
  clientePreseleccionado?: string;
}) {
  const inicio = hoyNegocio();
  const fin = sumarDiasInput(inicio, 1);

  const [clientes, unidadesIniciales] = await Promise.all([
    prisma.cliente.findMany({
      select: { id: true, nombre: true, telefono: true },
      orderBy: { nombre: "asc" },
    }),
    unidadesParaFechas(inicio, fin),
  ]);

  return (
    <AltaRenta
      clientes={clientes}
      unidadesIniciales={unidadesIniciales}
      fechasIniciales={{ inicio, fin }}
      clientePreseleccionado={clientePreseleccionado}
    />
  );
}
