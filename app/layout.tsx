import type { Metadata, Viewport } from "next";
import { BRAND } from "@/lib/brand";
import { Archivo } from "next/font/google";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "tilca · eventos culturales en La Paz", template: "%s · tilca" },
  description: "Todo lo que pasa esta semana en los escenarios de La Paz, en un solo mapa.",
  applicationName: "tilca",
  appleWebApp: { capable: true, title: "tilca", statusBarStyle: "default" },
  icons: { apple: "/pwa-icon/apple-180" },
  openGraph: { siteName: "tilca", locale: "es_BO", type: "website" },
};

export const viewport: Viewport = {
  themeColor: BRAND.primary,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
