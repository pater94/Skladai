"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { usePremium } from "@/lib/hooks/usePremium";
import { useUserMode } from "@/lib/hooks/useUserMode";
import { nsGet, nsSet } from "@/lib/native-storage";
import AgentChat from "./AgentChat";

// Flag pierwszego pokazania coachmarka — pamięć natywna (@capacitor/preferences
// via nsGet/nsSet; localStorage NIE utrzymuje stanu na natywce iOS).
const COACHMARK_KEY = "agent_coachmark_seen";

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
  // Hotfix post-merge (Patryk decision): AgentChat (FAB) TYLKO w trybie
  // fitness. W health/cosmetics chowamy — w przyszłości health dostanie
  // własną wersję agenta dostrojoną pod porady zdrowotne (osobny komponent
  // + osobny prompt z medical disclaimer), na razie HIDE.
  const { mode: userMode, loading: modeLoading } = useUserMode();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showCoachmark, setShowCoachmark] = useState(false);

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

  // Czy FAB jest aktualnie widoczny — te same warunki co early-returns niżej,
  // ale jako bool, żeby coachmark effect odpalił się TYLKO gdy FAB widać.
  const path = pathname || "";
  const fabVisible =
    mounted && !loading && !modeLoading && userMode === "fitness" && !onboarding &&
    !HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(p + "/")) &&
    ALLOWED_PATHS.has(path);

  // Coachmark jednorazowy: odczytaj flag asynchronicznie gdy FAB pierwszy raz
  // widoczny. Domyślnie ukryty (bez mignięcia) — pokaż dopiero gdy odczyt
  // potwierdzi że flag NIE jest ustawiony.
  useEffect(() => {
    if (!fabVisible || open) return;
    let cancelled = false;
    nsGet(COACHMARK_KEY)
      .then((v) => { if (!cancelled && v !== "true") setShowCoachmark(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fabVisible, open]);

  const dismissCoachmark = () => {
    setShowCoachmark(false);
    void nsSet(COACHMARK_KEY, "true");
  };

  if (!mounted) return null;
  if (loading) return null;
  if (modeLoading) return null;
  // Hotfix: AgentFAB tylko w fitness (TODO: health-specific agent)
  if (userMode !== "fitness") return null;
  if (onboarding) return null;
  if (HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return null;
  if (!ALLOWED_PATHS.has(path)) return null;
  if (open) return <AgentChat open={open} onClose={() => setOpen(false)} isPremium={isPremium} />;

  // Chat is always accessible. Free users get 5 lifetime trial messages;
  // the paywall prompt lives inside the chat UI, not here. Otwarcie czatu =
  // user odkrył FAB → zamknij coachmark + zapisz flag.
  const handleClick = () => {
    if (showCoachmark) dismissCoachmark();
    setOpen(true);
  };

  return (
    <>
      {/* Scrim — przygasza ekran za dymkiem; tap poza dymkiem = "Rozumiem". FAB i dymek zostają nad scrimem. */}
      {showCoachmark && (
        <div
          aria-hidden="true"
          onClick={dismissCoachmark}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 88 }}
        />
      )}

      {/* Coachmark — dymek nad FAB-em (jednorazowo, przy pierwszym wejściu) */}
      {showCoachmark && (
        <div className="agent-coach" style={{ position: "fixed", right: 14, bottom: 146, width: 230, zIndex: 92 }}>
          <div style={{ background: "var(--c-mint, #6efcb4)", color: "var(--c-ink, #0a0f0d)", borderRadius: 16, padding: "12px 14px", fontSize: 13, fontWeight: 600, lineHeight: 1.35, boxShadow: "0 10px 30px rgba(var(--c-mint-rgb, 110,252,180),0.27)" }}>
            👋 Zapytaj mnie o trening, dietę, a nawet o analizę Twoich badań.
            <div
              onClick={dismissCoachmark}
              role="button"
              style={{ marginTop: 9, fontSize: 12, fontWeight: 800, textDecoration: "underline", cursor: "pointer" }}
            >
              Rozumiem
            </div>
          </div>
          {/* ogonek skierowany w dół na FAB */}
          <div style={{ width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderTop: "10px solid var(--c-mint, #6efcb4)", marginLeft: "auto", marginRight: 26 }} />
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        aria-label="Otwórz Agenta AI"
        className="agent-fab"
        style={{
          position: "fixed",
          right: 16,
          bottom: 80, // sits above BottomNav (~64px tall)
          width: 56,
          height: 56,
          borderRadius: 18,
          background: "linear-gradient(135deg, var(--c-mint, #6efcb4), var(--c-green-2, #3dd990))",
          border: "1px solid rgba(var(--c-mint-rgb, 110,252,180),0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 6,
          zIndex: 90,
        }}
      >
        {/* Pierścień pulsujący tylko w trakcie coachmarka — przyciąga wzrok do FAB */}
        {showCoachmark && (
          <span className="agent-fab-ring" aria-hidden="true" style={{ position: "absolute", inset: -4, borderRadius: 22, border: "2px solid var(--c-mint, #6efcb4)", pointerEvents: "none" }} />
        )}
        <FabLogo size={36} />
      </button>

      <AgentChat open={open} onClose={() => setOpen(false)} isPremium={isPremium} />

      <style jsx>{`
        /* Spokojny idle glow — delikatne "oddychanie". Energia dopiero na press. */
        .agent-fab {
          box-shadow: 0 0 12px rgba(var(--c-mint-rgb, 110, 252, 180),0.27);
          animation: agentBreathe 3.2s ease-in-out infinite;
        }
        .agent-fab:active {
          box-shadow: 0 0 30px rgba(var(--c-mint-rgb, 110, 252, 180),0.68);
          animation: none;
        }
        @keyframes agentBreathe {
          0%, 100% { box-shadow: 0 0 12px rgba(var(--c-mint-rgb, 110, 252, 180),0.27); }
          50%      { box-shadow: 0 0 22px rgba(var(--c-mint-rgb, 110, 252, 180),0.47); }
        }
        .agent-fab-ring {
          animation: agentRingPulse 1.8s ease-out infinite;
        }
        @keyframes agentRingPulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        .agent-coach {
          animation: agentCoachIn 0.4s ease both;
        }
        @keyframes agentCoachIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .agent-fab,
          .agent-fab-ring,
          .agent-coach { animation: none; }
        }
      `}</style>
    </>
  );
}
