import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import SWUpdateBanner from "@/components/SWUpdateBanner";
import OnboardingWrapper from "@/components/OnboardingWrapper";
import CloudSync from "@/components/CloudSync";
import AppInit from "@/components/AppInit";

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
      {/*
        TEMPORARY PERSISTENT DIAGNOSTIC (remove once black-screen bug is fixed).

        Runs synchronously at the very top of <body>, BEFORE any React
        hydration script has a chance to fire. Logs five lifecycle
        events (app_start, dom_ready, hydration_check, js_error,
        promise_reject) to two sinks:

          1) localStorage[__skladai_errors] — ring buffer of 50 events.
             Survives reloads and app reopens. On a black-screen reopen
             we can later pull this out by mounting the localStorage
             via Safari on the web.

          2) POST /api/debug-log — the server just console.logs the
             payload. We read it from Vercel's runtime log viewer.
             Each POST carries ONE event so the server logs stay one
             line each and are trivial to grep.

        The fetch POST is wrapped in try/catch so a disconnected
        WebView never turns logging itself into the crash.
      */}
      <body style={{ fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif" }}>
        {/*
          ULTRA-MINIMAL PREACT PING (remove with the rest of the
          diagnostic scripts once the black-screen bug is fixed).

          The full error reporter below does a lot — ring buffer,
          sessionStorage, 5 event listeners, Object.prototype.hasOwnProperty
          loops. If anything in that script has a syntax quirk that
          iOS 26 WKWebView refuses to execute, ALL events are lost and
          we get no signal in Vercel logs.

          This tiny block runs first, with no modern syntax and
          no dependencies beyond fetch+JSON. If THIS doesn't reach
          /api/debug-log but Safari loading the same origin works,
          the problem is inline-script execution in WKWebView itself.
        */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var __w = window;
            var __body = {
              type: "preact_ping",
              ts: Date.now(),
              ua: navigator.userAgent,
              url: location.href,
              capacitorDefined: typeof __w.Capacitor,
              webkitDefined: typeof __w.webkit,
              messageHandlersExist: !!(__w.webkit && __w.webkit.messageHandlers),
              readyState: document.readyState,
              bodyChildren: (document.body && document.body.children.length) || 0
            };
            if (typeof fetch === "function") {
              fetch("/api/debug-log", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(__body),
                cache: "no-store",
                keepalive: true
              }).catch(function(){});
            }
            setTimeout(function(){
              try {
                fetch("/api/debug-log", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: "preact_alive_1s",
                    ts: Date.now(),
                    bodyChildren: (document.body && document.body.children.length) || 0,
                    readyState: document.readyState,
                    bodyInnerText: ((document.body && document.body.innerText) || "").slice(0, 80)
                  }),
                  cache: "no-store",
                  keepalive: true
                }).catch(function(){});
              } catch(__e) {}
            }, 1000);
          } catch(__e) {
            try {
              fetch("/api/debug-log", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "preact_ping_threw", msg: (__e && __e.message) || String(__e) }),
                cache: "no-store",
                keepalive: true
              }).catch(function(){});
            } catch(__e2) {}
          }
        ` }} />
        <script dangerouslySetInnerHTML={{ __html: `
          (function () {
            var LS_KEY = '__skladai_errors';
            var MAX_ENTRIES = 50;
            var sessionId = (function () {
              try {
                var s = sessionStorage.getItem('__skladai_sess');
                if (s) return s;
                s = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
                sessionStorage.setItem('__skladai_sess', s);
                return s;
              } catch (e) { return 'nosess'; }
            })();

            function truncate(v, n) {
              if (v == null) return v;
              var s = String(v);
              return s.length > n ? s.slice(0, n) + '...[truncated]' : s;
            }

            function buildEntry(type, data) {
              var e = {
                t: new Date().toISOString(),
                type: type,
                sess: sessionId,
                ua: truncate(navigator.userAgent || '', 300),
                url: truncate(location.href || '', 300)
              };
              if (data) {
                for (var k in data) {
                  if (Object.prototype.hasOwnProperty.call(data, k)) {
                    e[k] = typeof data[k] === 'string' ? truncate(data[k], 4000) : data[k];
                  }
                }
              }
              return e;
            }

            function appendLocal(entry) {
              try {
                var raw = localStorage.getItem(LS_KEY) || '[]';
                var logs;
                try { logs = JSON.parse(raw); } catch (e2) { logs = []; }
                if (!Array.isArray(logs)) logs = [];
                logs.push(entry);
                if (logs.length > MAX_ENTRIES) logs = logs.slice(-MAX_ENTRIES);
                localStorage.setItem(LS_KEY, JSON.stringify(logs));
              } catch (e) {
                // localStorage can throw in private-browsing modes; ignore.
              }
            }

            function postRemote(entry) {
              try {
                if (typeof fetch !== 'function') return;
                fetch('/api/debug-log', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(entry),
                  cache: 'no-store',
                  keepalive: true
                }).catch(function () { /* offline is fine */ });
              } catch (e) {
                // Never let logging itself crash the page.
              }
            }

            function logEvent(type, data) {
              var entry = buildEntry(type, data);
              appendLocal(entry);
              postRemote(entry);
            }

            // 1) App start — synchronous, first thing we do. Tells us
            //    the inline script reached evaluation at all on reopen.
            logEvent('app_start', {
              msg: 'app_started',
              bodyChildren: (document.body && document.body.children.length) || 0,
              referrer: truncate(document.referrer || '', 200),
              visibilityState: document.visibilityState || ''
            });

            // 2) DOM content loaded.
            document.addEventListener('DOMContentLoaded', function () {
              logEvent('dom_ready', {
                msg: 'dom_loaded',
                bodyChildren: document.body.children.length
              });
            });

            // 3) Still alive after 3s → hydration likely succeeded.
            setTimeout(function () {
              logEvent('hydration_check', {
                msg: 'alive_after_3s',
                bodyChildren: document.body.children.length,
                bodyHasContent: (document.body && document.body.innerText || '').length > 50
              });
            }, 3000);

            // 4) Any synchronous JS error bubbled up to window.
            window.addEventListener('error', function (e) {
              logEvent('js_error', {
                msg: e && e.message ? e.message : 'unknown',
                file: e && e.filename ? e.filename : '',
                line: e && e.lineno != null ? e.lineno : 0,
                col: e && e.colno != null ? e.colno : 0,
                stack: (e && e.error && e.error.stack) ? e.error.stack : null
              });
            });

            // 5) Unhandled promise rejection.
            window.addEventListener('unhandledrejection', function (e) {
              var r = (e && e.reason) || {};
              logEvent('promise_reject', {
                msg: (r && r.message) ? r.message : String(r == null ? 'unknown' : r),
                stack: (r && r.stack) ? r.stack : null
              });
            });
          })();
        ` }} />

        <div id="scroll-container" data-scrollable="true">
          {children}
        </div>
        <BottomNav />
        <SWUpdateBanner />
        <OnboardingWrapper />
        <CloudSync />
        <AppInit />
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
