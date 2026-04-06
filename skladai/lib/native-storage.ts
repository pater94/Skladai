/**
 * Native Storage Adapter
 *
 * Uses Capacitor Preferences (UserDefaults on iOS, SharedPreferences on Android)
 * on native platforms, falls back to localStorage on web.
 *
 * UserDefaults is NEVER cleared by iOS — survives app close, reopen, and OS updates.
 * Critical for persisting Supabase auth session in WKWebView where localStorage gets wiped.
 */

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

let didLogPlatform = false;
function logPlatformOnce() {
  if (didLogPlatform) return;
  didLogPlatform = true;
  try {
    console.log(
      "[NativeStorage] Platform:",
      Capacitor.getPlatform(),
      "isNative:",
      Capacitor.isNativePlatform(),
      "PreferencesPluginAvailable:",
      Capacitor.isPluginAvailable("Preferences")
    );
  } catch (e) {
    console.warn("[NativeStorage] Platform check failed:", e);
  }
}

/** Async get — returns null if not found. Tries Preferences first, falls back to localStorage. */
export async function nsGet(key: string): Promise<string | null> {
  logPlatformOnce();
  if (isNative()) {
    try {
      const { value } = await Preferences.get({ key });
      if (value !== null && value !== undefined) {
        console.log(`[NativeStorage] GET (Preferences) ${key}: ${value.length} chars`);
        return value;
      }
    } catch (e) {
      console.warn(`[NativeStorage] GET ${key} Preferences failed:`, e);
    }
  }
  try {
    const v = localStorage.getItem(key);
    if (v !== null) console.log(`[NativeStorage] GET (localStorage) ${key}: ${v.length} chars`);
    return v;
  } catch {
    return null;
  }
}

/** Async set — writes to BOTH Preferences and localStorage (belt and suspenders). */
export async function nsSet(key: string, value: string): Promise<void> {
  logPlatformOnce();
  if (isNative()) {
    try {
      await Preferences.set({ key, value });
      console.log(`[NativeStorage] SET (Preferences) ${key}: ${value.length} chars`);
    } catch (e) {
      console.warn(`[NativeStorage] SET ${key} Preferences failed:`, e);
    }
  }
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** Async remove — removes from BOTH Preferences and localStorage. */
export async function nsRemove(key: string): Promise<void> {
  logPlatformOnce();
  if (isNative()) {
    try {
      await Preferences.remove({ key });
      console.log(`[NativeStorage] REMOVE (Preferences) ${key}`);
    } catch {}
  }
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Self-test — verifies Preferences plugin is actually working at runtime.
 * Call once at app startup. Returns true if it works.
 */
export async function nsSelfTest(): Promise<boolean> {
  logPlatformOnce();
  const testKey = "__nsSelfTest__";
  const testVal = `t-${Date.now()}`;
  try {
    if (!isNative()) {
      console.log("[NativeStorage] SelfTest skipped — not native platform (web fallback active)");
      return false;
    }
    await Preferences.set({ key: testKey, value: testVal });
    const { value } = await Preferences.get({ key: testKey });
    await Preferences.remove({ key: testKey });
    const ok = value === testVal;
    console.log(`[NativeStorage] SelfTest result: ${ok ? "PASS ✅" : "FAIL ❌"} (wrote=${testVal}, read=${value})`);
    return ok;
  } catch (e) {
    console.error("[NativeStorage] SelfTest exception:", e);
    return false;
  }
}

/**
 * Storage adapter for Supabase auth.
 * On native: uses Preferences (UserDefaults) — survives app restart.
 * On web: uses localStorage.
 * Writes go to BOTH so a Supabase listener that reads from localStorage still sees the value.
 */
export const supabaseAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const v = await nsGet(key);
    console.log(`[SupabaseStorage] getItem(${key}) -> ${v ? "EXISTS" : "EMPTY"}`);
    return v;
  },
  async setItem(key: string, value: string): Promise<void> {
    console.log(`[SupabaseStorage] setItem(${key}) <- ${value.length} chars`);
    return nsSet(key, value);
  },
  async removeItem(key: string): Promise<void> {
    console.log(`[SupabaseStorage] removeItem(${key})`);
    return nsRemove(key);
  },
};
