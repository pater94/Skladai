/**
 * Global feature flags / environment switches.
 *
 * Keep values here simple and string/boolean — this module is imported
 * from both server and client code and must have zero side effects.
 */

/**
 * IS_DEMO:
 *   - true  = show 'DEMO — zakup nie zostanie zrealizowany' badge above
 *             every purchase CTA in the app. Use during the 14-day
 *             Google Play closed testing period and anywhere else
 *             RevenueCat isn't hooked up to real App Store / Play
 *             Store products yet.
 *   - false = production mode, badges hidden.
 *
 * ⚠️  CHANGE TO `false` BEFORE RELEASING TO APP STORE / PLAY STORE.
 *
 * All paywall CTAs render <DemoBadge /> (components/DemoBadge.tsx).
 * Flipping this single flag hides every instance at once.
 */
export const IS_DEMO = true;
