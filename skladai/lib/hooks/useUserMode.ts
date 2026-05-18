"use client";

/**
 * useUserMode — hook do bieżącego trybu aplikacji.
 *
 * Wzorowany na `usePremium` (event-driven refresh, fallback do localStorage).
 *
 * Source of truth: `getProfile().mode` z lib/storage.ts.
 * Trigger refresh:
 *   - "user-mode-changed" — dispatch z setUserMode() po update profilu
 *   - "local-data-changed" — dispatch z lib/storage.ts po dowolnej zmianie
 *                            profilu/danych (np. cloud pull)
 *
 * Default mode gdy brak: "fitness" (mint). Etap 1 zakłada że istniejący
 * userzy bez pola `mode` widzą się jako "fitness" — fallback nie wymusza
 * mode pickera (decyzja: tylko nowy onboarded user trafia w picker).
 */

import { useEffect, useState } from "react";
import { getProfile, saveProfile } from "@/lib/storage";
import type { UserMode } from "@/lib/types";

const DEFAULT_MODE: UserMode = "fitness";

export interface UseUserModeResult {
  mode: UserMode;
  /** true gdy user świadomie wybrał tryb; false gdy pominął lub fallback */
  explicitlyChosen: boolean;
  /** Czy istnieje JAKIKOLWIEK profile (jeśli nie — guest mode) */
  hasProfile: boolean;
  loading: boolean;
}

export function useUserMode(): UseUserModeResult {
  const [state, setState] = useState<UseUserModeResult>({
    mode: DEFAULT_MODE,
    explicitlyChosen: false,
    hasProfile: false,
    loading: true,
  });

  useEffect(() => {
    const refresh = () => {
      const profile = getProfile();
      setState({
        mode: (profile?.mode as UserMode | null | undefined) ?? DEFAULT_MODE,
        explicitlyChosen: Boolean(profile?.mode_explicitly_chosen),
        hasProfile: profile !== null,
        loading: false,
      });
    };
    refresh();

    if (typeof window === "undefined") return;
    // Custom event from setUserMode() — fires immediately on local change
    window.addEventListener("user-mode-changed", refresh);
    // Storage-wide change event — fires on profile save / cloud pull
    window.addEventListener("local-data-changed", refresh);
    return () => {
      window.removeEventListener("user-mode-changed", refresh);
      window.removeEventListener("local-data-changed", refresh);
    };
  }, []);

  return state;
}

/**
 * Setter trybu. Bezpieczne wywołanie z dowolnego miejsca (komponentu,
 * onClick handlera). Zapisuje do profilu + dispatchuje event.
 *
 * @param mode     wybrany tryb
 * @param explicit true gdy user świadomie kliknął kartę,
 *                 false gdy pominął lub fallback po zalogowaniu
 *                 starego profilu który nie miał `mode`
 *
 * Wymaga istniejącego profilu — jeśli brak, no-op (loguje warning).
 * Powód: setUserMode wywoływane wyłącznie po sign-in albo gdy user
 * jest już w aplikacji z profilem.
 */
export function setUserMode(mode: UserMode, explicit: boolean = true): void {
  if (typeof window === "undefined") return;
  const current = getProfile();
  if (!current) {
    console.warn("[setUserMode] Brak profilu — pomijam zapis trybu");
    return;
  }
  saveProfile({
    ...current,
    mode,
    mode_explicitly_chosen: explicit,
  });
  // Fire dedicated event for immediate refresh in all useUserMode consumers.
  // saveProfile() już dispatchuje "local-data-changed" — to dodatkowy event
  // semantyczny, łatwiejszy do śledzenia w devtools.
  window.dispatchEvent(new Event("user-mode-changed"));
}
