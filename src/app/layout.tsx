import type { Metadata, Viewport } from "next";
import { Manrope, Questrial, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

// Manrope es la tipografía de cuerpo/UI del diseño desktop; Questrial se
// reserva para títulos grandes (--font-heading).
const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const questrial = Questrial({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Climaxpress",
  description: "Administración de rentas de aerocoolers y calentones",
  applicationName: "Climaxpress",
  // iOS no lee el manifest: la pantalla completa (sin barras de Safari) y el
  // nombre bajo el icono se piden aquí.
  appleWebApp: {
    capable: true,
    title: "Climaxpress",
    // El contenido se dibuja bajo la barra de estado, así el azul del header
    // llega hasta arriba. El header compensa con padding de safe-area.
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#152b47",
  // Necesario para que env(safe-area-inset-*) valga algo en pantallas con notch.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${manrope.variable} ${questrial.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider>
          {children}
          {/* En la PWA de iOS el contenido corre bajo la barra de estado
              (viewportFit: cover), así que un toast arriba del todo queda
              tapado por el notch: se baja con el área segura. */}
          <Toaster
            position="top-center"
            duration={2000}
            offset={{ top: "16px" }}
            mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
