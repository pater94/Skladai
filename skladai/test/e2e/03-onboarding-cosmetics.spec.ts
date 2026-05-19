/**
 * Test 03 — Onboarding cosmetics mode
 * @smoke
 *
 * Fresh user → "Świat kosmetyków" → SkinProfileSetup → 3 kroki →
 * localStorage skladai_skin_profile ma dane.
 */

import { test, expect } from "@playwright/test";
import { mockSignIn, forceShowModePicker } from "../helpers/auth";
import { blockExternalNetwork } from "../helpers/mocks";

test.describe("Onboarding → cosmetics mode @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalNetwork(page);
    await mockSignIn(page, { mode: null });
  });

  test("cosmetics → SkinProfileSetup → zapis profilu skóry", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await forceShowModePicker(page);

    await expect(page.getByTestId("mode-picker-screen")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("mode-card-cosmetics").click();

    // SkinProfileSetup pojawia się
    const skinScreen = page.getByTestId("skin-profile-setup");
    await expect(skinScreen).toBeVisible({ timeout: 5_000 });

    // Krok 0: typ skóry — wybierz "Tłusta"
    await page.getByRole("button", { name: "Tłusta" }).click();

    // "Dalej"
    await page.getByRole("button", { name: /Dalej/i }).click();

    // Krok 1: problemy — zaznacz Trądzik
    await page.getByRole("button", { name: /Trądzik/i }).click();

    // "Dalej"
    await page.getByRole("button", { name: /Dalej/i }).click();

    // Krok 2: włosy (opcjonalnie) → po prostu Zapisz
    await page.getByRole("button", { name: /^Zapisz$/i }).click();

    // SkinProfileSetup znika
    await expect(skinScreen).toBeHidden({ timeout: 5_000 });

    // localStorage ma skin profile
    const skinProfile = await page.evaluate(() => {
      const raw = localStorage.getItem("skladai_skin_profile");
      return raw ? JSON.parse(raw) : null;
    });
    expect(skinProfile).not.toBeNull();
    expect(skinProfile.skin_type).toBe("oily");
    expect(skinProfile.skin_problems).toContain("Trądzik/wypryski");
  });
});
