import { prisma } from "@/lib/prisma";
import { hoyNegocio, sumarDiasInput } from "@/lib/fechas";
import { unidadesParaFechas } from "@/lib/actions/rentas";
import { RentaForm } from "@/components/renta-form";

/**
 * Alta de renta: carga clientes y unidades disponibles y monta el RentaForm.
 * Lo usan la pantalla completa (/rentas/nueva) y el pop-up (ruta interceptada).
 */
export async function RentaNueva({
  clientePreseleccionado,
  enModal = false,
}: {
  clientePreseleccionado?: string;
  enModal?: boolean;
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
    <RentaForm
      clientes={clientes}
      unidadesIniciales={unidadesIniciales}
      fechasIniciales={{ inicio, fin }}
      clientePreseleccionado={clientePreseleccionado}
      enModal={enModal}
    />
  );
}
