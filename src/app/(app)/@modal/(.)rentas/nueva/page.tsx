import { RentaNueva } from "@/components/renta-nueva";
import { RentaNuevaModal } from "@/components/renta-nueva-modal";

export const dynamic = "force-dynamic";

// Segmento literal: gana sobre el interceptor (.)rentas/[id], que si no trataría
// "nueva" como el id de una renta. Al venir por soft-nav desde /rentas, Next
// intercepta la navegación y el alta se abre como pop-up sobre la lista; una
// carga directa de /rentas/nueva no se intercepta y cae en la pantalla completa.
export default async function NuevaRentaModalPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;

  return (
    <RentaNuevaModal>
      <RentaNueva clientePreseleccionado={cliente} enModal />
    </RentaNuevaModal>
  );
}
