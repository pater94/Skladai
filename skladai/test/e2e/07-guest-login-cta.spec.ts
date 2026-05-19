/**
 * Test 07 — Guest user "Zaloguj się" CTA
 * @critical
 *
 * User bez auth (clean storage) → / → onboarding slides → /profil
 * powinno pokazywać CTA "Korzystasz bez konta" / "Zaloguj się".
 * Klik → onboarding login screen (state="login").
 */

import { test, expect } from "@playwright/test";
import { mockGuestUser } from "../helpers/auth";
import { blockExternalNetwork } from "../helpers/mocks";

test.describe("Guest user CTA @critical", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalNetwork(page);
    await mockGuestUser(page);
  });

  test("guest / → OnboardingLogin slides dostępne + Kontynuuj z Google/Apple", async ({ page }) => {
    // Guest user (brak `onboardingCompleted`) trafia od razu na
    // OnboardingLogin overlay (full slides), gdzie ostatni slide
    // ma OAuth buttons.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // OnboardingLogin powinien być widoczny — szukamy auth CTA.
    // Mogą wymagać scrollu do ostatniego slide (3 z 3).
    const continueWithGoogle = page.getByRole("button", { name: /Kontynuuj z Google/i });
    const continueWithApple = page.getByRole("button", { name: /Kontynuuj z Apple/i });
    const skipNoAccount = page.getByRole("button", { name: /korzystaj bez konta/i });

    // Przynajmniej jeden z auth CTA powinien być na DOM (last slide).
    // .first() aby uniknąć strict mode violation gdy oba są widoczne.
    await expect(continueWithGoogle.or(continueWithApple).first()).toBeVisible({ timeout: 10_000 });
    // Plus skip button — alternatywna ścieżka guest user
    await expect(skipNoAccount).toBeVisible();
  });
});
