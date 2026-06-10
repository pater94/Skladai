/**
 * Test 05 — Health features profile-driven (po zwinięciu trybu health)
 * @critical
 *
 * Logika `getHealthAlertsForScan` ma 21/21 pass w unit teście. Tu integration:
 * funkcje zdrowotne (MedicalDisclaimer + alerty) włączają się gdy PROFIL ma
 * schorzenia/alergie — niezależnie od trybu (po Patryk decision: 2 tryby).
 */

import { test, expect } from "@playwright/test";
import { blockExternalNetwork } from "../helpers/mocks";

test.describe("Health features profile-driven @critical", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalNetwork(page);
  });

  test("profil ze schorzeniami → MedicalDisclaimer widoczny na /", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("onboardingCompleted", "true");
      localStorage.setItem(
        "skladai_profile",
        JSON.stringify({
          id: "test-user-uuid",
          mode: "fitness",
          mode_explicitly_chosen: true,
          health: {
            conditions: ["lactose_intolerance", "hashimoto"],
            allergens: ["nuts"],
          },
        })
      );
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Disclaimer włącza się bo profil ma schorzenia/alergeny (profile-driven).
    await expect(page.getByTestId("medical-disclaimer")).toBeVisible({ timeout: 10_000 });
  });

  test("profil bez schorzeń → MedicalDisclaimer ukryty", async ({ page }) => {
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

    // Brak schorzeń → profileHasHealthContext=false → disclaimer null.
    await expect(page.getByTestId("medical-disclaimer")).toBeHidden();
  });
});
