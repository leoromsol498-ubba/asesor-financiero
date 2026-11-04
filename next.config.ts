import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Modelo de caché clásico: todas las páginas con sesión se renderizan en cada visita.
  cacheComponents: false,
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
