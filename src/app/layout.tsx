import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "PPG Courir à Sausset",
  description: "Inscriptions et présence aux séances de préparation physique générale.",
  applicationName: "PPG Courir à Sausset",
  appleWebApp: {
    capable: true,
    title: "PPG",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon-32x32.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#2d6a4f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geist.variable} h-full`}>
      <body className="min-h-full pb-[env(safe-area-inset-bottom)]">
        <AppHeader />
        <main className="pb-20 pt-4 md:pb-16 md:pt-6">{children}</main>
      </body>
    </html>
  );
}
