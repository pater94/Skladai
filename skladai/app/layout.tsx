import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import SWUpdateBanner from "@/components/SWUpdateBanner";
import OnboardingWrapper from "@/components/OnboardingWrapper";
import CloudSync from "@/components/CloudSync";

export const metadata: Metadata = {
  title: "SkładAI — Sprawdź co naprawdę jesz",
  description:
    "Zeskanuj etykietę produktu spożywczego, kosmetycznego lub zdjęcie dania. AI przeanalizuje skład, poda ocenę zdrowotności i praktyczne porady.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
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
        {/* Force iOS Safari "Add to Home Screen" PWA standalone mode (no URL bar) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SkładAI" />
      </head>
      <body style={{ fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif" }}>
        <div id="scroll-container" data-scrollable="true">
          {children}
        </div>
        <BottomNav />
        <SWUpdateBanner />
        <OnboardingWrapper />
        <CloudSync />
        {/* Block iOS rubber-band bounce on non-scrollable areas */}
        <script dangerouslySetInnerHTML={{ __html: `
          document.body.addEventListener('touchmove', function(e) {
            if (e.target.closest('[data-scrollable]')) return;
            if (e.target.closest('button, a, input, label, select, textarea')) return;
            e.preventDefault();
          }, { passive: false });
        `}} />
      </body>
    </html>
  );
}
