/**
 * DEMO tooling — gated on IS_DEMO (lib/config.ts).
 *
 * Exists purely so Patryk (solo dev / tester) can:
 *   1. Activate Premium locally without RevenueCat / App Store / Play
 *      billing — needed to test premium-only features and generate
 *      scan_logs data during the closed-testing period.
 *   2. Reset the AgentChat message counters (free lifetime + paid
 *      daily) so long testing sessions don't hit limits.
 *
 * Every function is a no-op if IS_DEMO is false — components that
 * import and call these can ship straight to production, the flag
 * flip hides the UI AND neuters the action.
 *
 * Before App Store / Play Store release:
 *   - set IS_DEMO = false in lib/config.ts
 *   - nothing in this file needs to be removed, but you can delete
 *     it (and the UI wiring in PremiumPaywall / AgentChat / Profil)
 *     if you want to be extra sure nobody can trigger these paths.
 */

import { activatePremium, deactivatePremium } from "@/lib/storage";
import { IS_DEMO } from "@/lib/config";

// These two keys are mirrored from AgentChat.tsx. Keep in sync if
// the chat counter keys are ever renamed.
const CHAT_FREE_COUNT_KEY = "agent_free_msgs";
const CHAT_PAID_COUNT_KEY = "agent_daily_msgs";
const CHAT_PAID_DATE_KEY = "agent_daily_date";

/**
 * Grant local premium entitlement for ~10 years. The 3650-day expiry
 * matches the 'lifetime' tier our RevenueCat dashboard would otherwise
 * issue once IAP is wired up. Existing premium hook (usePremium)
 * already falls back from RevenueCat to this localStorage entry via
 * isPremium(), so calling this is enough — no separate 'isDemo' flag
 * needed.
 */
export function activatePremiumDemo(): boolean {
  if (!IS_DEMO) return false;
  activatePremium(3650);
  return true;
}

/**
 * Revoke the local demo premium so the paywall / free-tier flow can
 * be tested again. RevenueCat-issued entitlements (if any were ever
 * active) stay untouched — isPremium()'s localStorage path is the
 * only thing this clears.
 */
export function deactivatePremiumDemo(): boolean {
  if (!IS_DEMO) return false;
  deactivatePremium();
  return true;
}

/**
 * Zero both AgentChat counters so an ongoing test session can keep
 * sending messages. Affects only localStorage — server-side Anthropic
 * usage still bills normally.
 */
export function resetChatLimitsDemo(): boolean {
  if (!IS_DEMO) return false;
  if (typeof window === "undefined") return false;
  try {
    localStorage.removeItem(CHAT_FREE_COUNT_KEY);
    localStorage.removeItem(CHAT_PAID_COUNT_KEY);
    localStorage.removeItem(CHAT_PAID_DATE_KEY);
    return true;
  } catch {
    return false;
  }
}
