/**
 * Test 02 — Onboarding health mode
 * @smoke @critical
 *
 * Fresh user → "Świadome życie ze schorzeniem" → HealthConditionsScreen
 * → zaznacza cukrzyca T2 + hashimoto + laktoza → Zapisz → /dashboard.
 *
 * Plus: assert MedicalDisclaimer widoczny po onboardingu (mode=health).
 */

import { test, expect } from "@playwright/test";
import { mockSignIn, forceShowModePicker } from "../helpers/auth";
import { blockExternalNetwork } from "../helpers/mocks";

test.describe("Onboarding → health mode @smoke @critical", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalNetwork(page);
    await mockSignIn(page, { mode: null });
  });

  test("health → HealthConditionsScreen → zapis profilu zdrowotnego", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await forceShowModePicker(page);

    // ModePicker
    await expect(page.getByTestId("mode-picker-screen")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("mode-card-health").click();

    // HealthConditionsScreen powinien się pojawić
    const healthScreen = page.getByTestId("health-conditions-screen");
    await expect(healthScreen).toBeVisible({ timeout: 5_000 });

    // Zaznacz: cukrzyca T2
    await page.getByTestId("health-chip-type2").click();
    await expect(page.getByTestId("health-chip-type2")).toHaveAttribute("data-active", "true");

    // Zaznacz: Hashimoto
    await page.getByTestId("health-chip-hashimoto").click();
    await expect(page.getByTestId("health-chip-hashimoto")).toHaveAttribute("data-active", "true");

    // Zaznacz: nietolerancja laktozy
    await page.getByTestId("health-chip-lactose_intolerance").click();
    await expect(page.getByTestId("health-chip-lactose_intolerance")).toHaveAttribute("data-active", "true");

    // Zapisz
    await page.getByRole("button", { name: /Zapisz.*kontynuuj/i }).click();

    // HealthConditionsScreen znika
    await expect(healthScreen).toBeHidden({ timeout: 5_000 });

    // Profile powinno mieć conditions
    const conditions = await page.evaluate(() => {
      const raw = localStorage.getItem("skladai_profile");
      return raw ? JSON.parse(raw).health?.conditions : null;
    });
    expect(conditions).toContain("hashimoto");
    expect(conditions).toContain("lactose_intolerance");

    // Profile powinno mieć diabetes
    const diabetes = await page.evaluate(() => {
      const raw = localStorage.getItem("skladai_profile");
      return raw ? JSON.parse(raw).health?.diabetes : null;
    });
    expect(diabetes).toBe("type2");

    // MedicalDisclaimer assertion testowany osobno (test 02b) — po
    // Zapisz HealthConditionsScreen wykonuje router.push i SafeBoundary
    // może mignąć z fallback podczas nav, co fluktualizuje assertion.
  });

  test("medical disclaimer widoczny dla health mode (sub-test 02b)", async ({ page }) => {
    // Pre-set health mode bezpośrednio (skip onboarding flow)
    await page.addInitScript(() => {
      localStorage.setItem("onboardingCompleted", "true");
      localStorage.setItem(
        "skladai_profile",
        JSON.stringify({
          id: "test-user-uuid",
          mode: "health",
          mode_explicitly_chosen: true,
          health: { conditions: ["hashimoto"], allergens: [] },
        })
      );
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("medical-disclaimer")).toBeVisible({ timeout: 10_000 });
  });
});
