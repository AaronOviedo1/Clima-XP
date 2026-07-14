import { auth } from "@/auth";
import { AUTH_HABILITADA } from "@/lib/auth-flag";

// Guard para server actions solo-admin (las páginas ya las protege el
// middleware). Mientras AUTH_HABILITADA sea false, todo usuario es admin.
export async function esAdmin(): Promise<boolean> {
  if (!AUTH_HABILITADA) return true;
  const session = await auth();
  return session?.user?.rol === "ADMIN";
}
