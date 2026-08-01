import { RentaNueva } from "@/components/renta-nueva";

export const dynamic = "force-dynamic";

// El header (volver, paso actual) lo pinta el propio flujo por pasos, con el
// patrón sticky de las demás pantallas móviles.
export default async function NuevaRentaPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;
  return <RentaNueva clientePreseleccionado={cliente} />;
}
