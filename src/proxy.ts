import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// El proxy (antes middleware) solo usa la config edge-safe (sin Prisma/bcrypt).
export default NextAuth(authConfig).auth;

export const config = {
  // Protege todo excepto assets estáticos y rutas internas de Next / API de auth.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
