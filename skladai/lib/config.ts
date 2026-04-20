/**
 * Global feature flags / environment switches.
 *
 * Keep values here simple and string/boolean — this module is imported
 * from both server and client code and must have zero side effects.
 */

/**
 * IS_DEMO:
 *   - true  = show DEMO activation buttons at every paywall CTA
 *             (one-tap local Premium + reset chat limits + reset
 *             premium demo in Profil). Purpose: let Patryk (solo
 *             dev) test premium features and generate scan_logs
 *             data without paying or wiring up RevenueCat.
 *   - false = production mode — DEMO buttons hidden, the helpers
 *             in lib/demo.ts become no-ops anyway.
 *
 * ⚠️  CHANGE TO `false` BEFORE RELEASING TO APP STORE / PLAY STORE.
 *
 * All DEMO entry points consume this flag:
 *   - app/premium/page.tsx            → "Aktywuj Premium DEMO" button
 *   - components/AgentChat.tsx        → "RESET LIMITÓW" footer button
 *                                        + "Aktywuj Premium DEMO"
 *                                        under both inline paywalls
 *   - components/PremiumGate.tsx      → "Aktywuj Premium DEMO"
 *   - app/profil/page.tsx             → "Narzędzia DEMO" section
 *
 * Flipping this one flag hides every DEMO surface at once.
 */
export const IS_DEMO = true;
