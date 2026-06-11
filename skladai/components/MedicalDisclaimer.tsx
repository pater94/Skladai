"use client";

/**
 * MedicalDisclaimer (Etap 2 Krok H) — krótka informacja prawna:
 * "Treści w SkładAI nie zastępują porady lekarskiej."
 *
 * Decyzja Q5=A: dynamiczna pozycja u dołu ekranu (NAD BottomNavem),
 * pokazywana TYLKO w trybie health i tylko poza stronami prawnymi
 * (privacy / regulamin / kontakt / support / delete-account / admin /
 * wyniki — te ostatnie mają własną stopkę). Można schować "X" w bieżącej
 * sesji (state in-memory, NIE persistuje, żeby user każdorazowo widział).
 *
 * Logika ukrywania:
 *   - tryb ≠ health           → null
 *   - profil nie załadowany   → null (no flash)
 *   - pathname w HIDDEN_PATHS → null
 *   - user kliknął X w tej sesji → null (do reloadu)
 *
 * Pozycja: fixed bottom, ~78px od dołu na nadrobienie BottomNav (60px)
 * + 18px gap. Z-index pod BottomNav (50) ale nad treścią (40).
 */

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useUserMode } from "@/lib/hooks/useUserMode";
import { getProfile } from "@/lib/storage";
import { profileHasHealthContext } from "@/lib/modes";

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

export default function MedicalDisclaimer() {
  const pathname = usePathname();
  // useUserMode tylko po to, by komponent re-renderował się na zmianę profilu
  // (event-driven) — sam gate jest po profile.health, nie po trybie.
  const { loading, hasProfile } = useUserMode();
  const [dismissed, setDismissed] = useState(false);

  // Wszystkie return-y guard po jednym miejscu — łatwiej debugować.
  if (loading || !hasProfile) return null;
  // Pokazuj disclaimer gdy user MA kontekst zdrowotny w profilu (schorzenia/
  // alergie) — zastępuje dawny gate `mode === "health"`.
  if (!profileHasHealthContext(getProfile())) return null;
  if (dismissed) return null;
  if (!pathname) return null;
  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  return (
    <div
      data-testid="medical-disclaimer"
      role="note"
      aria-label="Informacja medyczna"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 78, // 60px BottomNav + 18px gap
        transform: "translateX(-50%)",
        zIndex: 45,
        maxWidth: 420,
        width: "calc(100% - 24px)",
        padding: "8px 12px 8px 12px",
        borderRadius: 12,
        background: "rgba(15,23,42,0.78)",
        border: "1px solid rgba(var(--c-cyan-rgb, 34,211,238), 0.18)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.32)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 11,
        lineHeight: 1.35,
        color: "rgba(255,255,255,0.78)",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 13 }}>⚕️</span>
      <span style={{ flex: 1 }}>
        Treści w SkładAI mają charakter informacyjny i nie zastępują porady lekarskiej.
      </span>
      <button
        type="button"
        aria-label="Ukryj informację"
        onClick={() => setDismissed(true)}
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.55)",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          padding: "2px 6px",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
