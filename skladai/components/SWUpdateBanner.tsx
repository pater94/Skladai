"use client";

import { useState, useEffect } from "react";

/**
 * Detect if we're running inside a native Capacitor WebView. The
 * Capacitor bridge injects `window.Capacitor.isNativePlatform()` which
 * returns true only on iOS/Android native shells. Falling back to a UA
 * sniff catches the case where the bridge hasn't attached yet on first
 * render.
 */
function isCapacitorNative(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.() === true) return true;
  } catch {
    // ignore
  }
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  // WKWebView without Safari in the UA = native shell (or iOS standalone
  // PWA, which also doesn't need SW for our use case).
  return /Mobile\/\w+/.test(ua) && !/Safari\//.test(ua);
}

export default function SWUpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // In the Capacitor native app the SW + WKWebView combo was causing
    // a black screen on cold reopen — the SW would come up before the
    // WebView finished loading the page and somehow left the first
    // request dangling. We never install an SW here, and we actively
    // unregister any legacy one from earlier app versions + purge all
    // caches so nothing stale survives.
    if (isCapacitorNative()) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => undefined);
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => undefined);
      }
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg);

        // Check if there's already a waiting SW
        if (reg.waiting) {
          setShowBanner(true);
          return;
        }

        // Listen for new SW installing
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setShowBanner(true);
            }
          });
        });
      })
      .catch(() => {});

    // Reload when the new SW takes over
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const handleRefresh = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  };

  if (!showBanner) return null;

  return (
    <div
      className="fixed bottom-16 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 mx-3 rounded-t-xl shadow-lg"
      style={{
        background: "var(--sw-banner-bg, #1A3A0A)",
        color: "var(--sw-banner-text, #fff)",
      }}
    >
      <style>{`
        @media (prefers-color-scheme: dark) {
          :root {
            --sw-banner-bg: #1A3A0A;
            --sw-banner-text: #fff;
          }
        }
        @media (prefers-color-scheme: light) {
          :root {
            --sw-banner-bg: #fff;
            --sw-banner-text: #1A3A0A;
          }
        }
      `}</style>
      <span className="text-[13px] font-medium">
        Dostępna aktualizacja
      </span>
      <button
        onClick={handleRefresh}
        className="px-4 py-1.5 rounded-lg text-[12px] font-bold bg-[#84CC16] text-[#1A3A0A] active:scale-95 transition-all"
      >
        Odśwież
      </button>
    </div>
  );
}
