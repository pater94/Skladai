import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import SWUpdateBanner from "@/components/SWUpdateBanner";
import OnboardingWrapper from "@/components/OnboardingWrapper";
import CloudSync from "@/components/CloudSync";
import AppInit from "@/components/AppInit";
import AgentFAB from "@/components/AgentFAB";
import SafeBoundary from "@/components/SafeBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import MedicalDisclaimer from "@/components/MedicalDisclaimer";
import ModeNudge from "@/components/ModeNudge";

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
      <body
        style={{
          fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif",
          // Etap 2 Krok F: SSR-default mode accent na <body>. ThemeProvider
          // niżej nadpisuje po hydratacji jeśli user ma inny mode. Zapobiega
          // flash unstyled na pierwszym renderze.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ["--accent-main" as any]: "#6efcb4",
          ["--accent-rgb" as any]: "110,252,180",
          ["--accent-gradient" as any]: "linear-gradient(135deg, #4ade80, #6efcb4)",
          ["--accent-bg" as any]: "rgba(110,252,180,0.08)",
        }}
      >
        {/* Pre-paint: zastosuj zapisany motyw ZANIM wyrenderuje się treść
            (czyta localStorage — nsSet pisze do obu magazynów). Bez tego
            użytkownik Obsidianu widziałby mignięcie klasycznej palety. */}
        <script dangerouslySetInnerHTML={{ __html: `
          try { var v = localStorage.getItem('skladai_theme_variant'); if (['azure','violet','gold'].indexOf(v) !== -1) document.body.classList.add('theme-' + v); } catch (e) {}
        `}} />
        <ThemeProvider>
          <div id="scroll-container" data-scrollable="true">
            {children}
          </div>
          <BottomNav />
          <SWUpdateBanner />
          {/* OnboardingWrapper is the critical auth path — do NOT wrap it in
              a SafeBoundary. If it errors out, that's a real problem we need
              to see. */}
          <OnboardingWrapper />
          <SafeBoundary name="CloudSync"><CloudSync /></SafeBoundary>
          <SafeBoundary name="AppInit"><AppInit /></SafeBoundary>
          {/* AgentFAB pulls in useHealthData (dynamic @capgo/capacitor-health
              import) and the full AgentChat tree — any crash here must NOT
              take the rest of the app down with it. */}
          <SafeBoundary name="AgentFAB"><AgentFAB /></SafeBoundary>
          {/* Etap 2 Krok H: mode-aware bottom disclaimer (tylko health) +
              7-dniowy nudge dla userów którzy nie wybrali świadomie trybu.
              Oba self-guard w środku (sprawdzają pathname / mode / profil). */}
          <SafeBoundary name="MedicalDisclaimer"><MedicalDisclaimer /></SafeBoundary>
          <SafeBoundary name="ModeNudge"><ModeNudge /></SafeBoundary>
        </ThemeProvider>
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
