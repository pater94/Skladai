/**
 * Auth helpers dla Playwright testów SkładAi.
 *
 * Realna ścieżka auth (Supabase + Apple/Google OAuth + native bridge w
 * Capacitor) jest niemożliwa do automatyzacji w Playwright. Zamiast tego
 * mockujemy stan po-zalogowaniu przez bezpośrednie ustawienie kluczy
 * w localStorage których oczekuje aplikacja:
 *   - `onboardingCompleted` = "true" (skip onboarding slides)
 *   - `skladai_profile` z minimalnym UserProfile JSON
 *
 * To pozwala testować WSZYSTKO POZA flow logowania — czyli 95% UX.
 * Real OAuth flow testowany jest osobno przez Patryka manualnie /
 * smoke run na produkcji.
 */

import type { Page } from "@playwright/test";
import type { UserMode } from "../types";

export interface MockUser {
  id?: string;
  email?: string;
  mode?: UserMode | null;
  modeExplicit?: boolean;
  conditions?: string[];
  allergens?: string[];
  diabetes?: "type1" | "type2" | null;
  pregnancy?: boolean;
}

const ONBOARDED_KEY = "onboardingCompleted";
const PROFILE_KEY = "skladai_profile";

/**
 * Sygnaluje OnboardingWrapper że ma pokazać ModePickerScreen overlay.
 * Korzysta z istniejącego eventu `show-mode-picker` (Krok H prod feature
 * — ModeNudge "Wybierz" CTA i Profil DEMO reset go używają).
 *
 * Workaround: realny flow auth (Supabase getSession) jest niemożliwy
 * do zamockowania bo używa custom storage adapter z dynamic key.
 *
 * Retry loop: dispatchuje event co 200ms aż mode-picker pojawi się w DOM
 * (max 8s). To eliminuje race między hydratacją React (rejestracja
 * listener'a) i wcześniejszym dispatch.
 */
export async function forceShowModePicker(page: Page) {
  await page.waitForFunction(
    () => {
      window.dispatchEvent(new Event("show-mode-picker"));
      return !!document.querySelector('[data-testid="mode-picker-screen"]');
    },
    null,
    { timeout: 8_000, polling: 200 }
  ).catch(() => {
    // Fallback: jeśli mode-picker nie pojawia się mimo dispatchów,
    // assertion w teście to złapie z czytelnym komunikatem
  });
}

/**
 * Setup mock signed-in user. Wywołać PRZED `page.goto()` w teście —
 * używa `addInitScript` żeby localStorage był ustawiony zanim
 * komponenty React się zamontują.
 */
export async function mockSignIn(page: Page, user: MockUser = {}) {
  const profile = {
    id: user.id ?? "test-user-uuid",
    email: user.email ?? "test@example.com",
    mode: user.mode ?? null,
    mode_explicitly_chosen: user.modeExplicit ?? false,
    health: {
      conditions: user.conditions ?? [],
      allergens: user.allergens ?? [],
      diabetes: user.diabetes ?? null,
      pregnancy: user.pregnancy ?? false,
    },
  };

  await page.addInitScript(
    ({ onboardedKey, profileKey, profileJson }) => {
      localStorage.setItem(onboardedKey, "true");
      localStorage.setItem(profileKey, profileJson);
    },
    {
      onboardedKey: ONBOARDED_KEY,
      profileKey: PROFILE_KEY,
      profileJson: JSON.stringify(profile),
    }
  );

  // Stub auth check w OnboardingWrapper — bypass Supabase getSession()
  // przez fake `skladai_session_backup_v1` w nsGet, plus mock route
  // jeśli komponent woła supabase REST.
  await page.route("**/auth/v1/**", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user: { id: profile.id, email: profile.email },
      }),
    });
  });
}

/**
 * Wymuś stan "guest user" — brak profile, brak session.
 * Używane w teście 07 (login CTA).
 */
export async function mockGuestUser(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Reset stanu między testami — clear localStorage + sessionStorage.
 * Wywołać w `beforeEach` gdy test wymaga czystego stanu.
 */
export async function resetUser(page: Page) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
