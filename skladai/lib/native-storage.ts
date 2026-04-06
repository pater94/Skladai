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

/** Async get — returns null if not found */
export async function nsGet(key: string): Promise<string | null> {
  if (isNative()) {
    try {
      const { value } = await Preferences.get({ key });
      return value ?? null;
    } catch (e) {
      console.warn("[NativeStorage] get failed, falling back to localStorage:", e);
    }
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Async set */
export async function nsSet(key: string, value: string): Promise<void> {
  if (isNative()) {
    try {
      await Preferences.set({ key, value });
    } catch (e) {
      console.warn("[NativeStorage] set failed:", e);
    }
  }
  // Always also write to localStorage so sync libs that read it still work
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** Async remove */
export async function nsRemove(key: string): Promise<void> {
  if (isNative()) {
    try {
      await Preferences.remove({ key });
    } catch {}
  }
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Synchronous-style storage adapter for Supabase auth.
 * Supabase accepts a custom storage with async get/set/remove (since v2).
 *
 * On native: uses Preferences (UserDefaults) — survives app restart.
 * On web: uses localStorage.
 */
export const supabaseAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    return nsGet(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    return nsSet(key, value);
  },
  async removeItem(key: string): Promise<void> {
    return nsRemove(key);
  },
};
