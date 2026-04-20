"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { usePremium } from "@/lib/hooks/usePremium";
import AgentChat from "./AgentChat";

// Routes where the FAB is visible. Profil, /premium and /wyniki/*
// intentionally excluded. Native camera UI on iOS/Android overlays
// the WebView entirely, so no extra scan-active gate is needed.
const ALLOWED_PATHS = new Set(["/", "/forma", "/dashboard"]);
// Kept in sync with PUBLIC_ROUTES in OnboardingWrapper — legal /
// support pages are public docs and shouldn't host the in-app FAB.
const HIDDEN_PREFIXES = [
  "/premium",
  "/wyniki",
  "/admin",
  "/privacy",
  "/polityka-prywatnosci",
  "/support",
  "/kontakt",
  "/terms",
  "/regulamin",
  "/delete-account",
];

// Inline scanner logo for the FAB itself (small, emerald, no expert glow)
function FabLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512">
      <defs>
        <filter id="fabGlow">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="512" height="512" rx="108" fill="#0a0f0d" />
      <circle cx="256" cy="256" r="200" fill="rgba(110,252,180,0.06)" />
      <g stroke="#6efcb4" strokeWidth="20" strokeLinecap="round" fill="none" filter="url(#fabGlow)">
        <path d="M120 200 L120 140 Q120 120 140 120 L200 120" />
        <path d="M312 120 L372 120 Q392 120 392 140 L392 200" />
        <path d="M392 312 L392 372 Q392 392 372 392 L312 392" />
        <path d="M200 392 L140 392 Q120 392 120 372 L120 312" />
      </g>
      <text x="256" y="296" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontWeight="900" fontSize="200" fill="#6efcb4">S</text>
    </svg>
  );
}

export default function AgentFAB() {
  const pathname = usePathname();
  const { isPremium, loading } = usePremium();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Avoid SSR/hydration drift — same pattern as ActivityBadges
  useEffect(() => { setMounted(true); }, []);

  // Watch onboarding-active class on body (same as BottomNav) to hide during onboarding
  const [onboarding, setOnboarding] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const obs = new MutationObserver(() => {
      setOnboarding(document.body.classList.contains("onboarding-active"));
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    setOnboarding(document.body.classList.contains("onboarding-active"));
    return () => obs.disconnect();
  }, []);

  if (!mounted) return null;
  if (loading) return null;
  if (onboarding) return null;
  const path = pathname || "";
  if (HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return null;
  if (!ALLOWED_PATHS.has(path)) return null;
  if (open) return <AgentChat open={open} onClose={() => setOpen(false)} isPremium={isPremium} />;

  // Chat is always accessible. Free users get 5 lifetime trial messages;
  // the paywall prompt lives inside the chat UI, not here.
  const handleClick = () => setOpen(true);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Otwórz Agenta AI"
        style={{
          position: "fixed",
          right: 16,
          bottom: 80, // sits above BottomNav (~64px tall)
          width: 56,
          height: 56,
          borderRadius: 18,
          background: "linear-gradient(135deg, #6efcb4, #3dd990)",
          border: "1px solid rgba(110,252,180,0.4)",
          boxShadow: "0 8px 24px rgba(110,252,180,0.25), 0 0 0 0 rgba(110,252,180,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 6,
          zIndex: 90,
          animation: "agentFabPulse 3s ease-in-out infinite",
        }}
      >
        <FabLogo size={36} />
      </button>

      <AgentChat open={open} onClose={() => setOpen(false)} isPremium={isPremium} />

      <style jsx>{`
        @keyframes agentFabPulse {
          0%, 100% { box-shadow: 0 8px 24px rgba(110,252,180,0.25), 0 0 0 0 rgba(110,252,180,0.4); }
          50%      { box-shadow: 0 8px 28px rgba(110,252,180,0.35), 0 0 0 12px rgba(110,252,180,0); }
        }
      `}</style>
    </>
  );
}
