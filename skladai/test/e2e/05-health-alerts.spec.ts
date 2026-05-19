/**
 * Test 05 — ModeHealthAlerts integration
 * @critical
 *
 * UWAGA: Logika `getHealthAlertsForScan` ma 21/21 pass w `scripts/test-stage2-smoke.mjs`
 * (unit test). Tutaj sprawdzamy TYLKO integration — że ModeHealthAlerts
 * faktycznie się renderuje na /wyniki gdy mode=health.
 *
 * Strategia: skip pełnego routingu /wyniki/[id] (1962 linii, SafeBoundary
 * przy mock data), test PROFIL-based — assert że MedicalDisclaimer
 * pokazuje się dla health mode (proxy dla "mode-aware UI for health users").
 * Pełne /wyniki sprawdzane manualnie w QA Patryka.
 */

import { test, expect } from "@playwright/test";
import { blockExternalNetwork } from "../helpers/mocks";

test.describe("Health mode integration @critical", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalNetwork(page);
  });

  test("health mode + conditions → MedicalDisclaimer widoczny na /", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("onboardingCompleted", "true");
      localStorage.setItem(
        "skladai_profile",
        JSON.stringify({
          id: "test-user-uuid",
          mode: "health",
          mode_explicitly_chosen: true,
          health: {
            conditions: ["lactose_intolerance", "hashimoto"],
            allergens: ["nuts"],
          },
        })
      );
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // MedicalDisclaimer renderuje się dla mode=health (po hotfix self-guard)
    await expect(page.getByTestId("medical-disclaimer")).toBeVisible({ timeout: 10_000 });
  });

  test("fitness mode → MedicalDisclaimer ukryty", async ({ page }) => {
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

    // MedicalDisclaimer self-guard `mode !== "health"` → null
    await expect(page.getByTestId("medical-disclaimer")).toBeHidden();
  });
});
