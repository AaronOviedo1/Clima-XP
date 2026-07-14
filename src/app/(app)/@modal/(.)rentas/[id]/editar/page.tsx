import { RentaEditar } from "@/components/renta-editar";
import { RentaEditarModal } from "@/components/renta-editar-modal";

export const dynamic = "force-dynamic";

export default async function EditarRentaModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RentaEditarModal rentaId={id}>
      <RentaEditar id={id} enModal />
    </RentaEditarModal>
  );
}
