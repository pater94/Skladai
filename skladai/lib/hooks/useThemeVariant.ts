"use client";

/**
 * useThemeVariant — przełącznik motywu kolorystycznego aplikacji.
 *
 *   "classic"  — dotychczasowa kolorystyka (mięta na zielonkawej czerni).
 *                Tokeny :root w globals.css = dokładnie stare wartości,
 *                więc klasyczny wygląda IDENTYCZNIE jak przed zmianą.
 *   "obsidian" — premium dark: neutralny grafit + szmaragd (Profil → Wygląd).
 *
 * Mechanika: body.theme-obsidian przestawia tokeny --c-* / --bg / --hero-*
 * zdefiniowane w globals.css. Persist: nsSet (Capacitor Preferences +
 * localStorage — localStorage czyta też pre-paint script w layout.tsx,
 * żeby uniknąć mignięcia klasycznego przy starcie).
 */

import { useEffect, useState } from "react";
import { nsGet, nsSet } from "@/lib/native-storage";

export type ThemeVariant = "classic" | "obsidian";

export const THEME_VARIANT_KEY = "skladai_theme_variant";
const BODY_CLASS = "theme-obsidian";
const EVENT = "theme-variant-changed";

export function applyThemeVariant(variant: ThemeVariant): void {
  if (typeof document === "undefined") return;
  document.body.classList.toggle(BODY_CLASS, variant === "obsidian");
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
    const refresh = () => {
      // Źródło prawdy po mount: body class (pre-paint script mógł już ustawić)
      // + nsGet dla natywki, gdzie localStorage bywa czyszczony.
      const fromBody = document.body.classList.contains(BODY_CLASS);
      setVariantState(fromBody ? "obsidian" : "classic");
      nsGet(THEME_VARIANT_KEY)
        .then((v) => {
          if (cancelled) return;
          const stored: ThemeVariant = v === "obsidian" ? "obsidian" : "classic";
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
