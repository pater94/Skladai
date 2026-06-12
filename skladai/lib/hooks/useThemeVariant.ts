"use client";

/**
 * useThemeVariant — przełącznik motywu kolorystycznego aplikacji.
 *
 *   "classic" — dotychczasowa kolorystyka (mięta na zielonkawej czerni).
 *               Tokeny :root w globals.css = dokładnie stare wartości,
 *               więc klasyczny wygląda IDENTYCZNIE jak przed zmianą.
 *   "azure"   — Lazur: błękit electric na granatowej czerni.
 *   "violet"  — Ametyst: fiolet/magenta na ciemnej śliwce.
 *   "gold"    — Bursztyn: ciepłe złoto na grafitowym brązie.
 *   "light"   — Śnieżny: tryb JASNY (białe tła, ciemny tekst).
 *
 * Mechanika: body.theme-{variant} przestawia tokeny --c-* / --bg / --hero-*
 * zdefiniowane w globals.css. Persist: nsSet (Capacitor Preferences +
 * localStorage — localStorage czyta też pre-paint script w layout.tsx,
 * żeby uniknąć mignięcia klasycznego przy starcie).
 */

import { useEffect, useState } from "react";
import { nsGet, nsSet } from "@/lib/native-storage";

export type ThemeVariant = "classic" | "azure" | "violet" | "gold" | "light";

export const THEME_VARIANTS: ThemeVariant[] = ["classic", "azure", "violet", "gold", "light"];
export const THEME_VARIANT_KEY = "skladai_theme_variant";
// Wszystkie klasy motywów (poza klasycznym, który nie ma klasy).
const THEME_CLASSES = ["theme-azure", "theme-violet", "theme-gold", "theme-light"];
const EVENT = "theme-variant-changed";

export function applyThemeVariant(variant: ThemeVariant): void {
  if (typeof document === "undefined") return;
  document.body.classList.remove(...THEME_CLASSES);
  if (variant !== "classic") document.body.classList.add(`theme-${variant}`);
}

export function setThemeVariant(variant: ThemeVariant): void {
  if (typeof window === "undefined") return;
  applyThemeVariant(variant);
  void nsSet(THEME_VARIANT_KEY, variant);
  window.dispatchEvent(new Event(EVENT));
}

export function useThemeVariant(): {
  variant: ThemeVariant;
  setVariant: (v: ThemeVariant) => void;
} {
  const [variant, setVariantState] = useState<ThemeVariant>("classic");

  useEffect(() => {
    let cancelled = false;
    const normalize = (v: string | null): ThemeVariant =>
      v && (THEME_VARIANTS as string[]).includes(v) ? (v as ThemeVariant) : "classic";
    const refresh = () => {
      // Źródło prawdy po mount: body class (pre-paint script mógł już ustawić)
      // + nsGet dla natywki, gdzie localStorage bywa czyszczony.
      const fromBody = THEME_CLASSES.find((c) => document.body.classList.contains(c));
      setVariantState(fromBody ? (fromBody.replace("theme-", "") as ThemeVariant) : "classic");
      nsGet(THEME_VARIANT_KEY)
        .then((v) => {
          if (cancelled) return;
          const stored = normalize(v);
          applyThemeVariant(stored);
          setVariantState(stored);
        })
        .catch(() => {});
    };
    refresh();
    window.addEventListener(EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(EVENT, refresh);
    };
  }, []);

  return { variant, setVariant: setThemeVariant };
}
