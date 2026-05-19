/**
 * Test 10 — Bez błędów JS na publicznych routach
 * @smoke
 *
 * Każda publiczna route powinna załadować się bez `pageerror` (uncaught
 * JS exception). Console warnings są akceptowalne (np. Next prefetch),
 * ale uncaught throws = fail.
 */

import { test, expect } from "@playwright/test";
import { mockGuestUser } from "../helpers/auth";
import { blockExternalNetwork } from "../helpers/mocks";

const PUBLIC_ROUTES = [
  "/privacy",
  "/support",
  "/delete-account",
];

const AUTH_ROUTES = [
  "/",
  "/dashboard",
  "/profil",
  "/forma",
];

test.describe("Brak page errors @smoke", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`public ${route} — zero pageerror`, async ({ page }) => {
      await blockExternalNetwork(page);
      await mockGuestUser(page);
      const errors: Error[] = [];
      page.on("pageerror", (err) => errors.push(err));
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      expect(errors, errors.map((e) => e.message).join("\n")).toHaveLength(0);
    });
  }

  for (const route of AUTH_ROUTES) {
    test(`auth ${route} — zero pageerror (mocked sign-in)`, async ({ page }) => {
      await blockExternalNetwork(page);
      // Use authenticated user so OnboardingWrapper doesn't push to login overlay
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
      const errors: Error[] = [];
      page.on("pageerror", (err) => errors.push(err));
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      expect(errors, errors.map((e) => e.message).join("\n")).toHaveLength(0);
    });
  }
});
