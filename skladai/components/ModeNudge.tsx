"use client";

/**
 * ModeNudge (Etap 2 Krok H) — przypomnienie po ~7 dniach że user
 * jeszcze świadomie nie wybrał trybu aplikacji (pominął ModePicker
 * przy onboardingu albo to stary user przed Etap 1 dostał defaultowy
 * fitness fallback).
 *
 * UX:
 *   - Toast/bar pod headerem (top, fixed)
 *   - "Wybierz tryb dopasowany do Twoich celów" + CTA "Wybierz" + "X" snooze
 *   - "Wybierz" → dispatch("show-mode-picker") — OnboardingWrapper łapie
 *     event i ustawia state="mode-picker"
 *   - "X" → snooze na +7 dni (zapisuje timestamp w localStorage)
 *
 * Gatey:
 *   - !loading
 *   - hasProfile (musi być zalogowany / istnieć profil)
 *   - !explicitlyChosen (user pominął lub fallback)
 *   - pathname nie jest legal/wynikową stroną (ukrywamy na content-heavy)
 *   - Pierwsza wizyta zapisana ≥7 dni temu
 *   - Ostatni "snooze" ≥7 dni temu (lub nigdy)
 *
 * Storage keys:
 *   - skladai_mode_nudge_first_seen  — timestamp ISO pierwszej wizyty z tym
 *     gating'iem (zapisany przy pierwszym mount gdy condition spełnione)
 *   - skladai_mode_nudge_snoozed_at  — timestamp ISO ostatniego snooze
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useUserMode } from "@/lib/hooks/useUserMode";

const HIDDEN_PATHS = [
  "/privacy",
  "/polityka-prywatnosci",
  "/regulamin",
  "/terms",
  "/support",
  "/kontakt",
  "/delete-account",
  "/admin",
  "/wyniki",
];

const FIRST_SEEN_KEY = "skladai_mode_nudge_first_seen";
const SNOOZED_KEY = "skladai_mode_nudge_snoozed_at";
const DAYS_BEFORE_NUDGE = 7;
const SNOOZE_DAYS = 7;
const MS_PER_DAY = 86_400_000;

function readTimestamp(key: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const n = Date.parse(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeTimestamp(key: string, date: Date): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, date.toISOString());
  } catch {
    /* private mode — no-op */
  }
}

export default function ModeNudge() {
  const pathname = usePathname();
  const { loading, hasProfile, explicitlyChosen } = useUserMode();
  const [now, setNow] = useState<number>(() => Date.now());

  // Drobny tick raz przy mount — bez tego SSR↔CSR mismatch gdy zegar tyka
  // przez render. useEffect po hydratacji odświeża `now`.
  useEffect(() => {
    setNow(Date.now());
  }, []);

  // Snapshot first-seen + snoozed_at, ale TYLKO gdy gating logiczny
  // przepuszcza. Inaczej nie chcemy zapisać timestamp dla usera który
  // już świadomie wybrał (bo wtedy nigdy nudge'a nie zobaczy a key
  // zostaje w localStorage śmieciem).
  const shouldGateProgress = !loading && hasProfile && !explicitlyChosen;

  useEffect(() => {
    if (!shouldGateProgress) return;
    // Init first-seen tylko jeśli jeszcze nie ma w localStorage
    const existing = readTimestamp(FIRST_SEEN_KEY);
    if (existing === null) {
      writeTimestamp(FIRST_SEEN_KEY, new Date());
    }
  }, [shouldGateProgress]);

  if (loading || !hasProfile) return null;
  if (explicitlyChosen) return null;
  if (!pathname) return null;
  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  const firstSeen = readTimestamp(FIRST_SEEN_KEY);
  const snoozedAt = readTimestamp(SNOOZED_KEY);

  // Jeszcze nie minęło 7 dni od pierwszej wizyty z gating'iem
  if (firstSeen === null) return null;
  if (now - firstSeen < DAYS_BEFORE_NUDGE * MS_PER_DAY) return null;

  // Snooze aktywny
  if (snoozedAt !== null && now - snoozedAt < SNOOZE_DAYS * MS_PER_DAY) {
    return null;
  }

  const handleChoose = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("show-mode-picker"));
  };

  const handleSnooze = () => {
    writeTimestamp(SNOOZED_KEY, new Date());
    setNow(Date.now()); // wymuś rerender → gate ucina render
  };

  return (
    <div
      data-testid="mode-nudge"
      role="status"
      aria-label="Sugestia wyboru trybu"
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        maxWidth: 420,
        width: "calc(100% - 24px)",
        padding: "10px 12px",
        borderRadius: 14,
        background: "rgba(15,23,42,0.92)",
        border: "1px solid rgba(110,252,180,0.22)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.38)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>🎯</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(255,255,255,0.95)",
            marginBottom: 1,
          }}
        >
          Dopasuj SkładAI do swoich celów
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: "rgba(255,255,255,0.62)",
            lineHeight: 1.3,
          }}
        >
          Wybierz tryb — fitness, zdrowie lub kosmetyki.
        </div>
      </div>
      <button
        type="button"
        onClick={handleChoose}
        style={{
          padding: "7px 12px",
          borderRadius: 10,
          background: "linear-gradient(135deg, #4ade80, #6efcb4)",
          border: "none",
          color: "#06281b",
          fontSize: 11,
          fontWeight: 800,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Wybierz
      </button>
      <button
        type="button"
        aria-label="Przypomnij za tydzień"
        onClick={handleSnooze}
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.5)",
          fontSize: 16,
          fontWeight: 700,
          cursor: "pointer",
          padding: "2px 4px",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
