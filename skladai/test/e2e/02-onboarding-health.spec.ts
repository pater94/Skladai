/**
 * Test 02 — 2 tryby (po zwinięciu health) + disclaimer profile-driven
 * @smoke @critical
 *
 * Po usunięciu trybu "health" (Patryk decision): mode picker ma TYLKO 2 tryby
 * (fitness, cosmetics). Funkcje zdrowotne (MedicalDisclaimer + alerty) są
 * sterowane PROFILEM — pokazują się gdy user ma schorzenia/alergie, niezależnie
 * od trybu.
 */

import { test, expect } from "@playwright/test";
import { mockSignIn, forceShowModePicker } from "../helpers/auth";
import { blockExternalNetwork } from "../helpers/mocks";

test.describe("2 tryby + disclaimer profile-driven @smoke @critical", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalNetwork(page);
  });

  test("mode picker pokazuje 2 tryby, BEZ health", async ({ page }) => {
    await mockSignIn(page, { mode: null });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await forceShowModePicker(page);

    await expect(page.getByTestId("mode-picker-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("mode-card-fitness")).toBeVisible();
    await expect(page.getByTestId("mode-card-cosmetics")).toBeVisible();
    // Tryb health usunięty — karty nie ma.
    expect(await page.getByTestId("mode-card-health").count()).toBe(0);
  });

  test("MedicalDisclaimer widoczny gdy profil ma schorzenia (profile-driven)", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("onboardingCompleted", "true");
      localStorage.setItem(
        "skladai_profile",
        JSON.stringify({
          id: "test-user-uuid",
          mode: "fitness",
          mode_explicitly_chosen: true,
          health: { conditions: ["hashimoto"], allergens: [] },
        })
      );
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("medical-disclaimer")).toBeVisible({ timeout: 10_000 });
  });

  test("MedicalDisclaimer UKRYTY gdy profil bez schorzeń", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("onboardingCompleted", "true");
      localStorage.setItem(
        "skladai_profile",
        JSON.stringify({
          id: "test-user-uuid",
          mode: "fitness",
          mode_explicitly_chosen: true,
          health: { conditions: [], allergens: [] },
        })
      );
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("medical-disclaimer")).toBeHidden();
  });
});
