import type { Metadata, Viewport } from "next";
import { Questrial, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const questrial = Questrial({
  variable: "--font-sans",
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
      className={`${questrial.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
