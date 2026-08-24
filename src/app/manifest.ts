import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Climaxpress — Renta de aerocoolers y calentones",
    short_name: "Climaxpress",
    description: "Administración de rentas de aerocoolers y calentones",
    lang: "es-MX",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // El mismo azul del splash de arranque y de theme_color: Android pinta su
    // splash automático con este color, y así empalma con el animado sin que
    // se cuele un destello blanco entre los dos.
    background_color: "#152b47",
    theme_color: "#152b47",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android recorta el icono a la forma del launcher: estos traen el logo
      // dentro de la zona segura para que no se le coman las orillas.
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
