import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import SWUpdateBanner from "@/components/SWUpdateBanner";
import OnboardingWrapper from "@/components/OnboardingWrapper";
import CloudSync from "@/components/CloudSync";
import AppInit from "@/components/AppInit";
import AgentFAB from "@/components/AgentFAB";
import SafeBoundary from "@/components/SafeBoundary";

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
        {/*
          TEMPORARY DIAGNOSTIC (remove once black-screen bug is confirmed fixed).
          Registers window-level error + unhandledrejection handlers BEFORE
          React hydration runs. If a crash would otherwise turn the screen
          black, this replaces body contents with a red error panel showing
          the message, source location and stack — screenshot-friendly so
          the real cause can be identified from the user's device.
        */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function () {
            function render(title, msg, where, stack) {
              try {
                var safe = function (s) {
                  return String(s == null ? '' : s)
                    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                };
                var html =
                  '<div style="padding:16px;color:#fecaca;background:#0a0e0c;font-family:-apple-system,monospace;font-size:12px;line-height:1.5;min-height:100vh;overflow-y:auto;-webkit-overflow-scrolling:touch;">' +
                    '<h2 style="color:#ef4444;font-size:16px;margin:0 0 8px;">⚠️ ' + safe(title) + '</h2>' +
                    '<p style="margin:0 0 6px;color:#fca5a5;"><b>' + safe(msg) + '</b></p>' +
                    (where ? '<p style="margin:0 0 10px;color:#fbbf24;font-size:11px;">' + safe(where) + '</p>' : '') +
                    '<pre style="white-space:pre-wrap;word-break:break-word;background:#1a0f0f;padding:10px;border-radius:6px;color:#fde68a;font-size:11px;margin:0 0 12px;">' + safe(stack || '(no stack)') + '</pre>' +
                    '<button id="__sw_reset" style="padding:10px 14px;background:#6efcb4;color:#000;border:none;border-radius:8px;font-weight:800;font-size:13px;margin-right:8px;">Wyczyść cache i odśwież</button>' +
                    '<button id="__copy_err" style="padding:10px 14px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:8px;font-weight:700;font-size:13px;">Kopiuj błąd</button>' +
                  '</div>';
                if (document.body) {
                  document.body.innerHTML = html;
                  var resetBtn = document.getElementById('__sw_reset');
                  if (resetBtn) resetBtn.addEventListener('click', function () {
                    try {
                      if (navigator.serviceWorker) {
                        navigator.serviceWorker.getRegistrations().then(function (regs) {
                          regs.forEach(function (r) { r.unregister(); });
                          if (window.caches) {
                            caches.keys().then(function (ks) {
                              Promise.all(ks.map(function (k) { return caches.delete(k); }))
                                .then(function () { location.reload(); });
                            });
                          } else { location.reload(); }
                        });
                      } else { location.reload(); }
                    } catch (e) { location.reload(); }
                  });
                  var copyBtn = document.getElementById('__copy_err');
                  if (copyBtn) copyBtn.addEventListener('click', function () {
                    var text = title + '\\n' + msg + '\\n' + (where || '') + '\\n' + (stack || '');
                    try {
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text);
                      }
                    } catch (e) {}
                    copyBtn.textContent = '✅ Skopiowano';
                  });
                }
              } catch (renderErr) {
                console.error('[error-logger] render failed:', renderErr);
              }
            }
            window.addEventListener('error', function (e) {
              render(
                'BŁĄD JS',
                (e.message || 'unknown'),
                (e.filename || '') + ':' + (e.lineno || '') + ':' + (e.colno || ''),
                (e.error && e.error.stack) ? e.error.stack : ''
              );
            });
            window.addEventListener('unhandledrejection', function (e) {
              var r = e.reason || {};
              render(
                'PROMISE REJECT',
                (r.message || String(r) || 'unknown'),
                '',
                r.stack || ''
              );
            });
          })();
        ` }} />

        <div id="scroll-container" data-scrollable="true">
          {children}
        </div>
        <BottomNav />
        <SWUpdateBanner />
        {/* TEMPORARY: wrap OnboardingWrapper in SafeBoundary to isolate
            whether it is the source of the cold-start black screen. If
            the app now loads on reopen (without onboarding UI appearing),
            the crash is in OnboardingWrapper's session-restore path. */}
        <SafeBoundary name="OnboardingWrapper"><OnboardingWrapper /></SafeBoundary>
        <SafeBoundary name="CloudSync"><CloudSync /></SafeBoundary>
        <SafeBoundary name="AppInit"><AppInit /></SafeBoundary>
        {/* AgentFAB pulls in useHealthData (dynamic @capgo/capacitor-health
            import) and the full AgentChat tree — any crash here must NOT
            take the rest of the app down with it. */}
        <SafeBoundary name="AgentFAB"><AgentFAB /></SafeBoundary>
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
