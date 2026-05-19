/**
 * Profile manipulation helpers dla Playwright testów.
 *
 * Każdy helper modyfikuje localStorage I dispatchuje events które
 * istnieją w prod kodzie (`user-mode-changed`, `local-data-changed`)
 * żeby reactive hooks (useUserMode) podchwyciły zmianę bez full reload.
 */

import type { Page } from "@playwright/test";
import type { UserMode } from "../types";

const PROFILE_KEY = "skladai_profile";
const SKIN_PROFILE_KEY = "skladai_skin_profile";
const SCAN_MODE_KEY = "skladai_mode";

export async function setMode(page: Page, mode: UserMode, explicit = true) {
  await page.evaluate(
    ({ key, mode, explicit }) => {
      const raw = localStorage.getItem(key);
      const profile = raw ? JSON.parse(raw) : { id: "test-user-uuid" };
      profile.mode = mode;
      profile.mode_explicitly_chosen = explicit;
      localStorage.setItem(key, JSON.stringify(profile));
      window.dispatchEvent(new Event("user-mode-changed"));
      window.dispatchEvent(new Event("local-data-changed"));
    },
    { key: PROFILE_KEY, mode, explicit }
  );
}

export async function getMode(page: Page): Promise<UserMode | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw).mode ?? null;
    } catch {
      return null;
    }
  }, PROFILE_KEY);
}

export async function setAllergens(page: Page, allergens: string[]) {
  await page.evaluate(
    ({ key, allergens }) => {
      const raw = localStorage.getItem(key);
      const profile = raw ? JSON.parse(raw) : { id: "test-user-uuid" };
      profile.health = profile.health || {};
      profile.health.allergens = allergens;
      localStorage.setItem(key, JSON.stringify(profile));
      window.dispatchEvent(new Event("local-data-changed"));
    },
    { key: PROFILE_KEY, allergens }
  );
}

export async function setConditions(page: Page, conditions: string[]) {
  await page.evaluate(
    ({ key, conditions }) => {
      const raw = localStorage.getItem(key);
      const profile = raw ? JSON.parse(raw) : { id: "test-user-uuid" };
      profile.health = profile.health || {};
      profile.health.conditions = conditions;
      localStorage.setItem(key, JSON.stringify(profile));
      window.dispatchEvent(new Event("local-data-changed"));
    },
    { key: PROFILE_KEY, conditions }
  );
}

export async function setSkinProfile(
  page: Page,
  data: {
    skin_type: string;
    sensitivity?: string;
    skin_age?: string;
    skin_problems?: string[];
  }
) {
  await page.evaluate(
    ({ key, data }) => {
      const profile = {
        skin_type: data.skin_type,
        sensitivity: data.sensitivity ?? "normal",
        skin_age: data.skin_age ?? "25-35",
        skin_problems: data.skin_problems ?? [],
      };
      localStorage.setItem(key, JSON.stringify(profile));
    },
    { key: SKIN_PROFILE_KEY, data }
  );
}

/**
 * Force ModeNudge gating do "ready to show" — symuluje first_seen
 * sprzed 8 dni temu. Używane w teście 06.
 */
export async function fastForwardNudgeTimer(page: Page, daysAgo = 8) {
  await page.evaluate((days) => {
    const ts = new Date(Date.now() - days * 86400000).toISOString();
    localStorage.setItem("skladai_mode_nudge_first_seen", ts);
    localStorage.removeItem("skladai_mode_nudge_snoozed_at");
  }, daysAgo);
}

/**
 * Pre-set scan category w localStorage (przed wejściem na home).
 */
export async function setScanCategory(page: Page, category: string) {
  await page.addInitScript(
    ({ key, category }) => {
      localStorage.setItem(key, category);
    },
    { key: SCAN_MODE_KEY, category }
  );
}
