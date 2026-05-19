import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config dla SkładAi QA suite.
 *
 * Target URL hierarchy:
 *   1. TEST_URL env (CI / lokalne override)
 *   2. https://www.skladai.com (produkcja — default dla daily run)
 *
 * UWAGA: Vercel preview deployments mają SSO 401 paywall — testy
 * w GH Actions celują w prod TYLKO. Dla testowania PR-ów w przyszłości
 * Patryk może dodać VERCEL_AUTOMATION_BYPASS_SECRET (Settings → Deployment
 * Protection → Protection Bypass for Automation) i odpalać playwright
 * z `extraHTTPHeaders: { "x-vercel-protection-bypass": "..." }`.
 *
 * Mock strategy:
 *   - Realne `/api/analyze` nigdy NIE jest wywoływane (mock przez page.route)
 *   - Realne `/api/chat` mockowane (test 08 — agent personas)
 *   - Realne Apple/Google OAuth NIE testowane (mock przez localStorage)
 */
export default defineConfig({
  testDir: "./test/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 2 : 0,
  // Localhost smoke runy: 1 worker żeby uniknąć port conflicts i
  // localStorage cross-test contamination. CI używa 2 (każdy worker
  // dostaje osobny browser context).
  workers: process.env.CI ? 2 : 1,
  fullyParallel: true,

  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-results.json" }],
    ["github"],
  ],

  use: {
    baseURL: process.env.TEST_URL || "https://www.skladai.com",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    // Locale + timezone matchuje polish user
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
    // Skip pełnego "load" event — Capacitor/Supabase/Sentry scripts mogą
    // wisieć. DOM ready wystarczy dla testów które używają testid/text.
    // Per test można nadpisać przez `page.goto(url, { waitUntil: "load" })`.
  },

  projects: [
    {
      name: "iphone-14",
      use: {
        ...devices["iPhone 14"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
