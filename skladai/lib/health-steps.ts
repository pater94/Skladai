/**
 * Health Steps Wrapper for Capacitor
 *
 * Uses @capgo/capacitor-health to read step data from
 * HealthKit (iOS) and Health Connect (Android).
 * Falls back gracefully on web — all functions return null/empty.
 *
 * Usage:
 *   import { isHealthAvailable, requestStepPermissions, getTodaySteps, getWeekSteps } from "@/lib/health-steps";
 */

import { Capacitor } from "@capacitor/core";

// Lazy-import the plugin so the module loads fine on web
// where the native layer is absent.
let _health: typeof import("@capgo/capacitor-health").Health | null = null;

async function getHealth() {
  if (_health) return _health;
  try {
    const mod = await import("@capgo/capacitor-health");
    _health = mod.Health;
    return _health;
  } catch {
    return null;
  }
}

/** True when running inside a native Capacitor shell (iOS/Android). */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Check whether the native health SDK is available on this device. */
export async function isHealthAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const health = await getHealth();
    if (!health) return false;
    const result = await health.isAvailable();
    return result.available;
  } catch (err) {
    console.warn("[HealthSteps] isHealthAvailable error:", err);
    return false;
  }
}

/**
 * Request read permission for step data.
 * Returns true if permission was granted (or already granted).
 */
export async function requestStepPermissions(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const health = await getHealth();
    if (!health) return false;
    const status = await health.requestAuthorization({
      read: ["steps"],
    });
    // On iOS, HealthKit may not report denied — if 'steps' is not in
    // readDenied we treat it as authorized.
    return !status.readDenied.includes("steps");
  } catch (err) {
    console.warn("[HealthSteps] requestStepPermissions error:", err);
    return false;
  }
}

/**
 * Check whether step read permission is currently granted
 * (without prompting the user).
 */
export async function hasStepPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const health = await getHealth();
    if (!health) return false;
    const status = await health.checkAuthorization({ read: ["steps"] });
    return status.readAuthorized.includes("steps");
  } catch {
    return false;
  }
}

export interface DailySteps {
  /** ISO date string YYYY-MM-DD */
  date: string;
  steps: number;
}

/**
 * Get today's total step count.
 * Returns null if unavailable or not permitted.
 */
export async function getTodaySteps(): Promise<number | null> {
  if (!isNative()) return null;
  try {
    const health = await getHealth();
    if (!health) return null;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const result = await health.queryAggregated({
      dataType: "steps",
      startDate: startOfDay.toISOString(),
      endDate: now.toISOString(),
      bucket: "day",
      aggregation: "sum",
    });

    if (result.samples.length > 0) {
      return Math.round(result.samples[0].value);
    }
    return 0;
  } catch (err) {
    console.warn("[HealthSteps] getTodaySteps error:", err);
    return null;
  }
}

/**
 * Get step history for the last N days (default 7), one entry per day.
 * Returns an array sorted ascending by date.
 */
export async function getWeekSteps(days: number = 7): Promise<DailySteps[]> {
  if (!isNative()) return [];
  try {
    const health = await getHealth();
    if (!health) return [];

    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const result = await health.queryAggregated({
      dataType: "steps",
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      bucket: "day",
      aggregation: "sum",
    });

    // Build a map of date -> steps (some days may have no data)
    const map = new Map<string, number>();
    for (const sample of result.samples) {
      const d = new Date(sample.startDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      map.set(key, Math.round(sample.value));
    }

    // Fill in missing days with 0
    const output: DailySteps[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < days; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      output.push({ date: key, steps: map.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    return output;
  } catch (err) {
    console.warn("[HealthSteps] getWeekSteps error:", err);
    return [];
  }
}

/**
 * Open the Health Connect settings (Android only).
 * Useful if the user needs to install Health Connect or manage permissions.
 */
export async function openHealthSettings(): Promise<void> {
  try {
    const health = await getHealth();
    if (health) {
      await health.openHealthConnectSettings();
    }
  } catch (err) {
    console.warn("[HealthSteps] openHealthSettings error:", err);
  }
}
