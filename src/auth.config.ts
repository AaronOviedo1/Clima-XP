import type { NextAuthConfig, Session } from "next-auth";

// Rutas accesibles solo por ADMIN. El REPARTIDOR ve el dashboard y la ruta del día.
const RUTAS_SOLO_ADMIN = ["/reportes", "/configuracion", "/clientes", "/inventario"];

// Config edge-safe (sin Prisma ni bcrypt) — se comparte con el middleware.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    // Propaga id y rol al token / sesión.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.rol = user.rol;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.rol = token.rol as Session["user"]["rol"];
      }
      return session;
    },
    // Control de acceso a nivel middleware.
    authorized({ auth, request: { nextUrl } }) {
      const estaLogueado = !!auth?.user;
      const { pathname } = nextUrl;

      // Rutas públicas
      if (pathname.startsWith("/login")) {
        if (estaLogueado) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      if (!estaLogueado) return false;

      // Restricción por rol
      const esAdmin = auth!.user.rol === "ADMIN";
      const requiereAdmin = RUTAS_SOLO_ADMIN.some((r) => pathname.startsWith(r));
      if (requiereAdmin && !esAdmin) {
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
