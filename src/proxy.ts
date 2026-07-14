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
  // Tres exclusiones a propósito, todas por lo mismo (se piden sin cookies, y el
  // redirect al login las rompería en silencio):
  //   manifest.webmanifest → la app dejaría de ser instalable.
  //   sw.js                → el navegador lo rechaza si le llega HTML del login.
  //   api/cron             → Vercel los llama sin sesión; se autentican con CRON_SECRET.
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw\\.js|.*\\.png$).*)",
  ],
};
