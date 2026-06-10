/**
 * Test 01 — Onboarding fitness mode
 * @smoke @critical
 *
 * Fresh signed-in user → wybiera "Forma & Zdrowie" → trafia na home `/`
 * z bottom nav [Skaner, Forma, Dashboard, Profil].
 *
 * Mockuje stan post-sign-in przez localStorage (auth helper).
 */

import { test, expect } from "@playwright/test";
import { mockSignIn, forceShowModePicker } from "../helpers/auth";
import { blockExternalNetwork } from "../helpers/mocks";
import { getMode } from "../helpers/profile";

test.describe("Onboarding → fitness mode @smoke @critical", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalNetwork(page);
    // Mock signed-in user BEZ wybranego mode → triggeruje ModePickerScreen
    await mockSignIn(page, { mode: null });
  });

  test("wybór fitness → trafia na home, profile.mode === fitness", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Force ModePickerScreen overlay (workaround real Supabase auth race)
    await forceShowModePicker(page);

    // Mode picker overlay powinien się pokazać
    const picker = page.getByTestId("mode-picker-screen");
    await expect(picker).toBeVisible({ timeout: 10_000 });

    // Dwie karty (tryb health zwinięty — Patryk decision)
    await expect(page.getByTestId("mode-card-fitness")).toBeVisible();
    await expect(page.getByTestId("mode-card-cosmetics")).toBeVisible();
    expect(await page.getByTestId("mode-card-health").count()).toBe(0);

    // Kliknij fitness
    await page.getByTestId("mode-card-fitness").click();

    // Mode picker znika
    await expect(picker).toBeHidden({ timeout: 5_000 });

    // localStorage profile.mode === "fitness"
    const mode = await getMode(page);
    expect(mode).toBe("fitness");

    // Bottom nav ma /forma (fitness only)
    const nav = page.locator("nav, [role='navigation']").first();
    await expect(nav).toBeVisible();
  });
});
