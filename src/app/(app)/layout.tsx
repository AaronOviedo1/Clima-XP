import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BottomNav } from "@/components/bottom-nav";
import { Sidebar } from "@/components/desktop/sidebar";
import { TopBar } from "@/components/desktop/top-bar";
import { SeccionProvider } from "@/components/desktop/seccion";
import { RegistrarSW } from "@/components/push/registrar-sw";
import { AUTH_HABILITADA, USUARIO_POR_DEFECTO } from "@/lib/auth-flag";
import { fechaDesdeInput, fechaLarga, hoyNegocio } from "@/lib/fechas";

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  // Con el login oculto se omite la sesión y se usa un usuario por defecto.
  const session = AUTH_HABILITADA ? await auth() : null;
  if (AUTH_HABILITADA && !session?.user) redirect("/login");

  const usuario = session?.user ?? USUARIO_POR_DEFECTO;
  const esAdmin = usuario.rol === "ADMIN";
  const nombre = usuario.name ?? "Usuario";
  const fechaHoy = fechaLarga(fechaDesdeInput(hoyNegocio()));

  // Shell responsive: en `lg+` aparece el sidebar oscuro + header claro del
  // diseño desktop; en móvil se conserva AppHeader + BottomNav.
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip lg:h-dvh lg:min-h-0 lg:flex-row lg:overflow-hidden">
      <Sidebar nombre={nombre} esAdmin={esAdmin} authHabilitada={AUTH_HABILITADA} />

      {/* El provider envuelve TopBar y contenido: una página publica su
          subtítulo (<SubtituloSeccion>) o sus botones (<AccionesSeccion>)
          y el TopBar los pinta. */}
      <SeccionProvider>
        <div className="flex min-w-0 flex-1 flex-col lg:h-dvh lg:overflow-hidden">
          {/* TopBar usa useSearchParams (buscador en vivo): el <Suspense> evita el
              error de bailout a CSR al prerenderizar páginas no dinámicas. */}
          <Suspense fallback={null}>
            <TopBar esAdmin={esAdmin} fechaHoy={fechaHoy} />
          </Suspense>

          <main className="flex-1 px-5 pt-[calc(env(safe-area-inset-top)+14px)] pb-28 md:px-8 lg:overflow-y-auto lg:px-[30px] lg:pt-7 lg:pb-7">
            <div className="mx-auto w-full max-w-3xl md:max-w-4xl lg:max-w-[1360px]">
              {children}
            </div>
          </main>

          {modal}
          <div className="lg:hidden">
            <BottomNav esAdmin={esAdmin} />
          </div>
        </div>
      </SeccionProvider>

      <RegistrarSW />
    </div>
  );
}
