import type { Session } from "next-auth";

/**
 * Interruptor para ocultar/mostrar el login sin borrar su implementación.
 *
 * - `false` → la app entra directo sin pedir inicio de sesión (estado actual).
 * - `true`  → se vuelve a exigir login (Auth.js, roles, middleware, etc.).
 *
 * Todo el código de autenticación (auth.ts, auth.config.ts, /login,
 * server actions) sigue en su lugar: solo hay que poner esto en `true`.
 */
export const AUTH_HABILITADA = true;

/**
 * Usuario asumido mientras el login está oculto. Se le da rol ADMIN para
 * que todas las rutas queden accesibles sin sesión.
 */
export const USUARIO_POR_DEFECTO: Session["user"] = {
  id: "sin-login",
  name: "Climaxpress",
  email: "",
  rol: "ADMIN",
};
