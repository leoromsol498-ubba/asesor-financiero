import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asesor Financiero",
  description: "Gastos, presupuesto, metas de ahorro y alertas de pagos.",
  appleWebApp: { capable: true, title: "Asesor", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
