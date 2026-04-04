import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import SWUpdateBanner from "@/components/SWUpdateBanner";
import OnboardingWrapper from "@/components/OnboardingWrapper";

export const metadata: Metadata = {
  title: "SkładAI — Sprawdź co naprawdę jesz",
  description:
    "Zeskanuj etykietę produktu spożywczego, kosmetycznego lub zdjęcie dania. AI przeanalizuje skład, poda ocenę zdrowotności i praktyczne porady.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SkładAI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1A3A0A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <link rel="icon" href="/icons/icon-192.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#84CC16" />
      </head>
      <body style={{ fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif" }}>
        <div id="scroll-container">
          {children}
        </div>
        <BottomNav />
        <SWUpdateBanner />
        <OnboardingWrapper />
      </body>
    </html>
  );
}
