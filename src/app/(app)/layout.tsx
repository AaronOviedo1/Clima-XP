import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";

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
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        {children}
      </main>
      <BottomNav esAdmin={esAdmin} />
    </div>
  );
}
