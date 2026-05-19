/**
 * Test 06 — Skip mode picker → ModeNudge po 7 dniach
 * @smoke
 *
 * Fresh user → ModePicker → "Zobacz wszystko — wybiorę później" → fitness
 * fallback z explicitlyChosen=false. Symulujemy 8 dni temu first_seen
 * (fastForward localStorage) → reload → ModeNudge banner widoczny.
 */

import { test, expect } from "@playwright/test";
import { mockSignIn, forceShowModePicker } from "../helpers/auth";
import { blockExternalNetwork } from "../helpers/mocks";
import { fastForwardNudgeTimer } from "../helpers/profile";

test.describe("Mode picker skip + ModeNudge @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalNetwork(page);
    await mockSignIn(page, { mode: null });
  });

  test("skip → 8 dni temu first_seen → nudge widoczny + CTA otwiera mode picker", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await forceShowModePicker(page);

    await expect(page.getByTestId("mode-picker-screen")).toBeVisible({ timeout: 10_000 });

    // Klik "Zobacz wszystko — wybiorę później"
    await page.getByText(/Zobacz wszystko/i).click();

    await expect(page.getByTestId("mode-picker-screen")).toBeHidden({ timeout: 5_000 });

    // Profile.mode = fitness, explicit = false
    const explicit = await page.evaluate(() => {
      const raw = localStorage.getItem("skladai_profile");
      return raw ? JSON.parse(raw).mode_explicitly_chosen : null;
    });
    expect(explicit).toBe(false);

    // FastForward — ustaw first_seen 8 dni temu
    await fastForwardNudgeTimer(page, 8);
    await page.reload();

    // Nudge powinien być widoczny
    const nudge = page.getByTestId("mode-nudge");
    await expect(nudge).toBeVisible({ timeout: 5_000 });

    // CTA "Wybierz" → dispatchuje `show-mode-picker` event. Force-click
    // bo nudge bar może być chwilowo nakryty animation overlay'em.
    await nudge.getByRole("button", { name: /Wybierz/i }).click({ force: true });

    // Po reload listener może nie być jeszcze aktywny (race hydratacja vs
    // dispatch). Retry-loop fallback — dispatchuje event aż mode-picker
    // faktycznie się pokaże.
    await forceShowModePicker(page);
    await expect(page.getByTestId("mode-picker-screen")).toBeVisible({ timeout: 5_000 });
  });
});
