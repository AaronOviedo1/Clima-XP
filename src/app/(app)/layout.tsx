import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const esAdmin = session.user.rol === "ADMIN";

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader nombre={session.user.name ?? "Usuario"} esAdmin={esAdmin} />
      <div className="flex flex-1">
        <Sidebar esAdmin={esAdmin} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 md:max-w-4xl md:px-8 md:py-6">
          {children}
        </main>
      </div>
      <BottomNav esAdmin={esAdmin} />
    </div>
  );
}
