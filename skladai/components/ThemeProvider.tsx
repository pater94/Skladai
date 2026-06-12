"use client";

/**
 * ThemeProvider (Etap 2 Krok F) — exposuje mode-aware accent jako:
 *   1. CSS variables na `<div>` wrapper (`--accent-main`, `--accent-rgb`,
 *      `--accent-gradient`) — komponenty mogą używać `var(--accent-main, fallback)`
 *      w inline styles bez importu hooka
 *   2. React Context (`useTheme()`) — gdy komponent woli JS reference
 *
 * Decyzja Q3 = C (per-route dominuje, mode-accent fallback):
 *   - Mode accent stosujemy w komponentach które używają CSS var
 *   - Route-specific theming (/forma orange, /promile indigo, /biegacz
 *     orange) zostaje hardcoded w tych stronach — NIE używają var
 *   - BottomNav już ma logikę "route > mode > brand" (Krok B)
 *
 * Default ON: mount ustawia var(--accent-main) zgodnie z bieżącym mode.
 * Hydration safe: SSR ustawia fitness defaults, client hydration nadpisuje
 * po pierwszym useUserMode read.
 */

import { createContext, useContext, useMemo } from "react";
import { useUserMode } from "@/lib/hooks/useUserMode";
import { useThemeVariant, type ThemeVariant } from "@/lib/hooks/useThemeVariant";
import type { UserMode } from "@/lib/types";

interface AccentSet {
  /** Solid hex color (#6efcb4 itd.) */
  main: string;
  /** "r,g,b" tuple do rgba(...) w inline styles */
  rgb: string;
  /** Gotowy gradient (CTA buttons, hero icons) */
  gradient: string;
  /** Subtelne tło accent (bg cards, tinted surfaces) */
  bg: string;
}

// Realne hexy (nie var(--…)) — accent.main bywa czytany w JS (getComputedStyle
// w testach, ewentualne canvas/SVG); wariant motywu wybiera zestaw niżej.
// fitness = akcent brandowy danego motywu; cosmetics zachowuje fioletową
// tożsamość (poza Ametystem, gdzie i tak jest fioletowo).
const COSMETIC_VIOLET: AccentSet = {
  main: "#C084FC",
  rgb: "192,132,252",
  gradient: "linear-gradient(135deg, #a78bfa, #C084FC)",
  bg: "rgba(192,132,252,0.08)",
};
const MODE_ACCENTS: Record<ThemeVariant, Record<UserMode, AccentSet>> = {
  classic: {
    fitness: {
      main: "#6efcb4",
      rgb: "110,252,180",
      gradient: "linear-gradient(135deg, #4ade80, #6efcb4)",
      bg: "rgba(110,252,180,0.08)",
    },
    cosmetics: COSMETIC_VIOLET,
  },
  azure: {
    fitness: {
      main: "#38bdf8",
      rgb: "56,189,248",
      gradient: "linear-gradient(135deg, #0ea5e9, #38bdf8)",
      bg: "rgba(56,189,248,0.08)",
    },
    cosmetics: COSMETIC_VIOLET,
  },
  violet: {
    fitness: {
      main: "#a78bfa",
      rgb: "167,139,250",
      gradient: "linear-gradient(135deg, #8b5cf6, #a78bfa)",
      bg: "rgba(167,139,250,0.08)",
    },
    cosmetics: COSMETIC_VIOLET,
  },
  gold: {
    fitness: {
      main: "#f5c14e",
      rgb: "245,193,78",
      gradient: "linear-gradient(135deg, #f59e0b, #f5c14e)",
      bg: "rgba(245,193,78,0.08)",
    },
    cosmetics: COSMETIC_VIOLET,
  },
  // Tryb jasny — akcenty przyciemnione, by były czytelne na białym tle.
  light: {
    fitness: {
      main: "#059669",
      rgb: "5,150,105",
      gradient: "linear-gradient(135deg, #10b981, #059669)",
      bg: "rgba(5,150,105,0.10)",
    },
    cosmetics: {
      main: "#7c3aed",
      rgb: "124,58,237",
      gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
      bg: "rgba(124,58,237,0.10)",
    },
  },
};

interface ThemeContextValue {
  accent: AccentSet;
  mode: UserMode;
}

const ThemeContext = createContext<ThemeContextValue>({
  accent: MODE_ACCENTS.classic.fitness,
  mode: "fitness",
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useUserMode();
  const { variant } = useThemeVariant();
  const effectiveMode = (mode ?? "fitness") as UserMode;
  const accent = useMemo(() => MODE_ACCENTS[variant][effectiveMode], [variant, effectiveMode]);

  return (
    <ThemeContext.Provider value={{ accent, mode: effectiveMode }}>
      <div
        // Wrapper div z CSS variables — propagują się w głąb drzewa DOM.
        // display:contents żeby div nie wpływał na layout (nie tworzy
        // własnego flex/grid item, dzieci są bezpośrednie children parenta).
        style={{
          display: "contents",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ["--accent-main" as any]: accent.main,
          ["--accent-rgb" as any]: accent.rgb,
          ["--accent-gradient" as any]: accent.gradient,
          ["--accent-bg" as any]: accent.bg,
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

/** Hook do JS access. Komponenty wolą CSS var (var(--accent-main)) gdy się da. */
export function useTheme() {
  return useContext(ThemeContext);
}
