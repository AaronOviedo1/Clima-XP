import { auth } from "@/auth";
import { AUTH_HABILITADA, USUARIO_POR_DEFECTO } from "@/lib/auth-flag";
import { prisma } from "@/lib/prisma";
import { rentaInclude } from "@/lib/rentas";
import { RentaDetalle } from "@/components/renta-detalle";
import { RentaModal } from "@/components/renta-modal";

export const dynamic = "force-dynamic";

export default async function RentaModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const renta = await prisma.renta.findUnique({
    where: { id },
    include: rentaInclude,
  });
  if (!renta) return null;

  const session = AUTH_HABILITADA ? await auth() : null;
  const usuario = session?.user ?? USUARIO_POR_DEFECTO;

  return (
    <RentaModal rentaId={renta.id}>
      <RentaDetalle renta={renta} enModal esAdmin={usuario.rol === "ADMIN"} />
    </RentaModal>
  );
}
