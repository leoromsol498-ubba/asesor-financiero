import type { MetadataRoute } from "next";

// Permite "Agregar a pantalla de inicio" en el celular.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Asesor Financiero",
    short_name: "Asesor",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
