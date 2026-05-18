/**
 * Definicje 3 trybów aplikacji (etap 1: mode picker po sign in).
 *
 * Używane przez:
 *   - components/ModePickerScreen.tsx (full-screen onboarding)
 *   - app/profil/page.tsx (sekcja "Tryb aplikacji")
 *   - lib/hooks/useUserMode.ts (state + setter)
 *
 * Etap 1: wybór tryby zapisuje się do UserProfile.mode + dispatch
 * "user-mode-changed" event. Konsekwencje (różne UI per mode, persona
 * AI, kolejność tabów) przychodzą w etapie 2+.
 */

import type { UserMode } from "@/lib/types";

export interface ModeDef {
  id: UserMode;
  label: string;
  desc: string;
  color: string;        // hex z #
  colorRgb: string;     // "r,g,b" tuple do rgba(...)
  emoji: string;        // floating emoji nad ikoną (dla mode picker)
  /** SVG paths-only (bez <svg> wrappera) — wrapper dodaje komponent renderujący */
  iconPaths: React.ReactNode;
  /** Speed orbital ring rotacji w sekundach */
  ringSpeed: number;
  /** Direction orbital ring rotacji */
  ringDir: "normal" | "reverse";
  /** Float delay dla emoji (s) */
  floatDelay: number;
}

import React from "react";

export const MODES: ModeDef[] = [
  {
    id: "fitness",
    label: "Forma & Zdrowie",
    desc: "Kalorie, makro, sen, kroki i skan składu ciała ze zdjęcia",
    color: "#6efcb4",
    colorRgb: "110,252,180",
    emoji: "📈",
    ringSpeed: 8,
    ringDir: "normal",
    floatDelay: 0,
    iconPaths: (
      <>
        <path d="M5 24L11 18L15 22L21 14L27 18" />
        <path d="M22 14H27V19" strokeWidth="1.8" />
        <path d="M5 28H27" opacity="0.4" strokeWidth="1.2" />
        <circle cx="11" cy="18" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="15" cy="22" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="21" cy="14" r="1.5" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    id: "health",
    label: "Świadome życie ze schorzeniem",
    desc: "Cukrzyca, alergie, nietolerancje",
    color: "#22d3ee",
    colorRgb: "34,211,238",
    emoji: "🛡️",
    ringSpeed: 10,
    ringDir: "reverse",
    floatDelay: 1.2,
    iconPaths: (
      <>
        <path d="M16 4L6 8V16C6 21.5 10 26 16 28C22 26 26 21.5 26 16V8L16 4Z" />
        <path d="M9 17H12L13.5 14L15 19L17 15L18.5 17H23" strokeWidth="1.8" />
      </>
    ),
  },
  {
    id: "cosmetics",
    label: "Świat kosmetyków",
    desc: "INCI, składy, typ skóry",
    color: "#C084FC",
    colorRgb: "192,132,252",
    emoji: "✨",
    ringSpeed: 7,
    ringDir: "normal",
    floatDelay: 2.4,
    iconPaths: (
      <>
        <path d="M16 4V14M16 18V28M4 16H14M18 16H28" />
        <path d="M16 14C16 14 14 16 14 16C14 16 16 18 16 18C16 18 18 16 18 16C18 16 16 14 16 14Z" fill="currentColor" stroke="none" />
        <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
        <path d="M9 9L11 11M21 21L23 23M23 9L21 11M9 23L11 21" strokeWidth="1.2" />
      </>
    ),
  },
];

export const MODE_LABELS: Record<UserMode, string> = {
  fitness: "Forma & Zdrowie",
  health: "Świadome życie ze schorzeniem",
  cosmetics: "Świat kosmetyków",
};

export function getModeDef(mode: UserMode): ModeDef {
  return MODES.find((m) => m.id === mode) ?? MODES[0];
}
