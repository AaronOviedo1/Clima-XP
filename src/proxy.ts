import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { AUTH_HABILITADA } from "@/lib/auth-flag";

// El proxy (antes middleware) solo usa la config edge-safe (sin Prisma/bcrypt).
// Con el login oculto (AUTH_HABILITADA=false) el proxy no hace nada y deja pasar
// todo. Al reactivar login vuelve a proteger según auth.config.
export default AUTH_HABILITADA
  ? NextAuth(authConfig).auth
  : () => NextResponse.next();

export const config = {
  // El matcher debe ser un literal estático para que Next lo analice en build.
  // Protege todo excepto assets estáticos y rutas internas de Next / API de auth.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
