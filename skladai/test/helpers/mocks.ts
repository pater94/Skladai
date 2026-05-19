/**
 * Network mocks dla Playwright. Pokrycie:
 *   - /api/analyze — produkcyjny scanner (NIE wywołujemy realnego Claude API)
 *   - /api/chat — agent AI chat
 *   - /api/tts — text-to-speech (skip)
 *   - Supabase REST endpoints (auth + scan_logs)
 *
 * Wszystkie mocki używają `page.route` (intercept). Per-test można
 * override'ować przez podanie konkretnego payloadu.
 */

import type { Page } from "@playwright/test";

export interface MockScanOptions {
  result?: Record<string, unknown>;
  status?: number;
  delayMs?: number;
}

/**
 * Mock /api/analyze odpowiedź — używać w testach które renderują
 * /wyniki/[id] (np. test #5 — health alerts).
 */
export async function mockScanAPI(page: Page, options: MockScanOptions = {}) {
  const { result, status = 200, delayMs = 0 } = options;
  await page.route("**/api/analyze", async (route) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    return route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(result ?? DEFAULT_SCAN_RESULT),
    });
  });
}

/**
 * Mock /api/chat — używać w testach 8 (agent personas).
 * Streaming response — Playwright fulfill obsługuje to przez body.
 */
export async function mockChatAPI(page: Page, welcomeText: string) {
  await page.route("**/api/chat", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ type: "text", content: welcomeText })}\n\ndata: [DONE]\n\n`,
    });
  });
}

/**
 * Block external network — żeby testy nie wisiały na 3rd party calls.
 * Wywołać raz w `beforeEach`.
 */
export async function blockExternalNetwork(page: Page) {
  await page.route(/(supabase\.co|anthropic\.com|googleapis\.com|appleid\.apple\.com|googletagmanager|posthog|sentry)/, (route) => {
    return route.fulfill({ status: 204, body: "" });
  });
}

// ────────────────────────────────────────────────────────────────────
// Default scan result (food category, fitness mode)
// ────────────────────────────────────────────────────────────────────

export const DEFAULT_SCAN_RESULT = {
  type: "food",
  name: "Test Product",
  brand: "Test Brand",
  weight: "100g",
  score: 7,
  verdict_short: "Dobry wybór",
  verdict: "Produkt zbilansowany, ale uwaga na cukier dodany.",
  ingredients: [
    { name: "mąka pszenna", original: "mąka pszenna", harmful: false },
    { name: "cukier", original: "cukier", harmful: false },
  ],
  nutrition: [
    { label: "Wartość energetyczna", value: "320 kcal" },
    { label: "Tłuszcz", value: "8g" },
    { label: "Cukry", value: "15g" },
    { label: "Białko", value: "9g" },
  ],
  allergens: ["gluten"],
  pros: ["Zawiera błonnik"],
  cons: ["Zawiera cukier dodany"],
  tip: "Najlepiej spożywać przed południem.",
};
