import { Suspense } from "react";
import { auth } from "@/auth";
import { AUTH_HABILITADA, USUARIO_POR_DEFECTO } from "@/lib/auth-flag";
import { prisma } from "@/lib/prisma";
import { rentaInclude } from "@/lib/rentas";
import { Skeleton } from "@/components/ui/skeleton";
import { RentaDetalle } from "@/components/renta-detalle";
import { RentaModal } from "@/components/renta-modal";

export const dynamic = "force-dynamic";

// Un solo Dialog: el pop-up (RentaModal) se monta al instante y el detalle se
// carga dentro de un <Suspense>. El esqueleto es el fallback, así que vive en el
// MISMO Dialog que el contenido — sin loading.tsx aparte, que montaba un segundo
// Dialog y provocaba el "doble pop-up" (esqueleto y luego info).
export default async function RentaModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RentaModal rentaId={id}>
      <Suspense fallback={<DetalleSkeleton />}>
        <DetalleContenido id={id} />
      </Suspense>
    </RentaModal>
  );
}

async function DetalleContenido({ id }: { id: string }) {
  const renta = await prisma.renta.findUnique({
    where: { id },
    include: rentaInclude,
  });
  if (!renta) return null;

  const session = AUTH_HABILITADA ? await auth() : null;
  const usuario = session?.user ?? USUARIO_POR_DEFECTO;

  return <RentaDetalle renta={renta} enModal esAdmin={usuario.rol === "ADMIN"} />;
}

function DetalleSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2 pr-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
