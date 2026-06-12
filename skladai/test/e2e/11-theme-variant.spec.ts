/**
 * Test 11 — Przełącznik motywu (Klasyczny / Obsidian)
 * @critical
 *
 * Architektura: design tokens w globals.css — :root = klasyczne wartości
 * (identyczne z dawnymi hardcodami), body.theme-{azure|violet|gold} = nowe
 * palety. Przełącznik: Profil → "Wygląd aplikacji" (useThemeVariant, nsSet
 * persist, pre-paint script w layout.tsx czyta localStorage przed renderem).
 */

import { test, expect } from "@playwright/test";
import { blockExternalNetwork } from "../helpers/mocks";

const PROFILE_INIT = () => {
  localStorage.setItem("onboardingCompleted", "true");
  localStorage.setItem(
    "skladai_profile",
    JSON.stringify({
      id: "test-user-uuid",
      mode: "fitness",
      mode_explicitly_chosen: true,
      gender: "male", age: 30, weight_kg: 80, height_cm: 180,
      health: { conditions: [], allergens: [] },
    })
  );
  localStorage.setItem("agent_coachmark_seen", "true");
};

test.describe("Motyw Klasyczny/Obsidian @critical", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalNetwork(page);
  });

  test("domyślnie KLASYCZNY: brak klasy, tokeny = stare wartości", async ({ page }) => {
    await page.addInitScript(PROFILE_INIT);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    const hasClass = await page.evaluate(() =>
      ["theme-azure", "theme-violet", "theme-gold"].some((c) => document.body.classList.contains(c))
    );
    expect(hasClass).toBe(false);

    const mint = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("--c-mint").trim().toLowerCase()
    );
    expect(mint).toBe("#6efcb4"); // klasyczna mięta — pixel-perfect jak przed zmianą

    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("--bg").trim().toLowerCase()
    );
    expect(bg).toBe("#0a0e0c");
  });

  test("przełączenie na LAZUR w profilu: klasa + tokeny + persist po reload", async ({ page }) => {
    await page.addInitScript(PROFILE_INIT);
    await page.goto("/profil", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // JS-click (omija ewentualną nakładkę onboardingu — wzorzec z innych testów)
    const clicked = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="theme-card-azure"]') as HTMLElement | null;
      if (el) { el.click(); return true; }
      return false;
    });
    expect(clicked).toBe(true);
    await page.waitForTimeout(400);

    // Klasa + tokeny przestawione natychmiast
    expect(await page.evaluate(() => document.body.classList.contains("theme-azure"))).toBe(true);
    const mint = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("--c-mint").trim().toLowerCase()
    );
    expect(mint).toBe("#38bdf8"); // błękit Lazuru

    // Persist: localStorage zapisany, po reloadzie pre-paint przywraca motyw
    expect(await page.evaluate(() => localStorage.getItem("skladai_theme_variant"))).toBe("azure");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.body.classList.contains("theme-azure"))).toBe(true);

    // Powrót do klasycznego
    await page.evaluate(() => {
      (document.querySelector('[data-testid="theme-card-classic"]') as HTMLElement | null)?.click();
    });
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.body.classList.contains("theme-obsidian"))).toBe(false);
    expect(await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("--c-mint").trim().toLowerCase()
    )).toBe("#6efcb4");
  });
});
