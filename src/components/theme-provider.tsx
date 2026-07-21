"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Tema por sistema (claro/oscuro según `prefers-color-scheme`). Aplica la clase
 * `dark` en <html>, que activa los tokens `.dark` de globals.css y las
 * variantes `dark:` de Tailwind. Sin toggle manual: sigue al sistema.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
