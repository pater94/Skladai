/**
 * Test 09 — Theme accent CSS variable per mode
 * @critical
 *
 * Dla każdego z 3 trybów: ustaw mode → / → assert
 * `getComputedStyle(body).getPropertyValue('--accent-main')` matchuje
 * oczekiwany hex.
 *
 * Source of truth: components/ThemeProvider.tsx — MODE_ACCENTS:
 *   fitness:   #6efcb4 (mint)
 *   cosmetics: #C084FC (violet)
 * (tryb health zwinięty — Patryk decision.)
 */

import { test, expect } from "@playwright/test";
import { blockExternalNetwork } from "../helpers/mocks";
import type { UserMode } from "../types";

const EXPECTED: Record<UserMode, string> = {
  fitness: "#6efcb4",
  cosmetics: "#c084fc", // toLowerCase compare
};

test.describe("Theme accent CSS var per mode @critical", () => {
  for (const [mode, expectedHex] of Object.entries(EXPECTED) as [UserMode, string][]) {
    test(`${mode}: --accent-main === ${expectedHex}`, async ({ page }) => {
      await blockExternalNetwork(page);
      // Direct localStorage setup (skip mockSignIn który może wywoływać
      // navigation race przez OnboardingWrapper auth flow)
      await page.addInitScript((modeVal) => {
        localStorage.setItem("onboardingCompleted", "true");
        localStorage.setItem(
          "skladai_profile",
          JSON.stringify({
            id: "test-user-uuid",
            mode: modeVal,
            mode_explicitly_chosen: true,
            health: { conditions: [], allergens: [] },
          })
        );
      }, mode);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      // Daj hydratacji + OnboardingWrapper async check ustabilizować się
      await page.waitForTimeout(1000);
      // Wait dla load event — wszystkie async nawigacje zakończone
      await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});

      // ThemeProvider wraps children w div z display:contents — CSS vars
      // propagują się tylko do dzieci tego wrappera, NIE do body. Body ma
      // SSR-default mint (z app/layout.tsx). Czytamy z `#scroll-container`
      // który JEST dzieckiem ThemeProvider → tam var jest faktycznie
      // ustawiona zgodnie z bieżącym mode.
      await expect
        .poll(async () => {
          return page.evaluate(() => {
            const el = document.querySelector("#scroll-container");
            if (!el) return null;
            return getComputedStyle(el)
              .getPropertyValue("--accent-main")
              .trim()
              .toLowerCase();
          }).catch(() => null);
        }, { timeout: 10_000, intervals: [200, 500, 1000] })
        .toBe(expectedHex);
    });
  }
});
