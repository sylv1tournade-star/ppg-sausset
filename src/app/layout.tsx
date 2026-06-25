import type { Metadata } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geist.variable} h-full`}>
      <body className="min-h-full">
        <AppHeader />
        <main className="pb-16 pt-6">{children}</main>
      </body>
    </html>
  );
}
