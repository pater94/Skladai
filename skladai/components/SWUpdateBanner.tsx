"use client";

import { useState, useEffect } from "react";

export default function SWUpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

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
