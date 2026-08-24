import { LogoAnimado } from "./logo-animado";

/**
 * Pantalla de arranque de la PWA instalada.
 *
 * Es markup estático a propósito: **no lleva nada de JavaScript**. Quién lo ve
 * lo decide el CSS (`@media (display-mode: standalone)`, ver globals.css) y
 * cuándo se va lo decide una animación con `forwards` que termina en
 * `visibility: hidden`. Así el splash no puede quedarse trabado tapando la app
 * — no depende de que React hidrate ni de que corra ningún efecto.
 *
 * Por eso tampoco usa `esStandalone()` de `lib/push-cliente.ts`: ese helper es
 * de cliente y correría después de hidratar, cuando el splash ya llegó tarde.
 *
 * Vive en el layout raíz para que también cubra `/login`, que es lo primero que
 * se ve al abrir la app sin sesión.
 */
export function SplashArranque() {
  return (
    <div className="splash" aria-hidden="true">
      <LogoAnimado className="splash-logo" />
    </div>
  );
}
