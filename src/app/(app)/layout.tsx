import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { AUTH_HABILITADA, USUARIO_POR_DEFECTO } from "@/lib/auth-flag";

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

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader nombre={usuario.name ?? "Usuario"} esAdmin={esAdmin} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 md:max-w-4xl md:px-8 md:py-6">
        {children}
      </main>
      {modal}
      <BottomNav esAdmin={esAdmin} />
    </div>
  );
}
