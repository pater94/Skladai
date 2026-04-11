"use client";

import { createClient } from "@/lib/supabase";

/**
 * Cloud Sync — persists all user data to Supabase `user_data` table.
 *
 * SQL to create the table (run once in Supabase SQL Editor):
 *
 *   CREATE TABLE user_data (
 *     user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 *     data JSONB NOT NULL DEFAULT '{}',
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "read_own"  ON user_data FOR SELECT USING (auth.uid() = user_id);
 *   CREATE POLICY "insert_own" ON user_data FOR INSERT WITH CHECK (auth.uid() = user_id);
 *   CREATE POLICY "update_own" ON user_data FOR UPDATE USING (auth.uid() = user_id);
 */

// Keys that hold user personalization / data worth syncing
const SYNC_KEYS = [
  "skladai_profile",
  "skladai_history",
  "skladai_weight_history",
  "skladai_diary",
  "skladai_streak",
  "skladai_last_scan_date",
  "skladai_skin_profile",
  "skladai_strength_records",
  "skladai_measurements",
  "skladai_progress_photos",
  "skladai_biegacz_records",
  "skladai_biegacz_progress",
  "skladai_biegacz_race_plan",
  "skladai_shopping",
  "skladai_expenses",
  "skladai_saved_recipes",
  "skladai_fridge_products",
  "skladai_routine_data",
  "skladai_lazienka_categories",
  "skladai_recent_searches",
  "skladai_favorites",
  "skladai_battle_stats",
  "skladai_max_streak",
  "skladai_checkforms",
  "skladai_achievements_earned",
  "onboardingCompleted",
];

// ─── helpers ───

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;

function collectLocal(): Record<string, string> {
  const bag: Record<string, string> = {};
  for (const key of SYNC_KEYS) {
    const v = localStorage.getItem(key);
    if (v !== null) bag[key] = v;
  }
  return bag;
}

/** Merge array-type keys (history, diary, weight) by unique id/date */
function mergeArrayKey(localRaw: string | null, cloudRaw: string | unknown): string {
  try {
    const local: unknown[] = localRaw ? JSON.parse(localRaw) : [];
    const cloud: unknown[] = typeof cloudRaw === "string" ? JSON.parse(cloudRaw) : Array.isArray(cloudRaw) ? cloudRaw : [];

    // Build set of local IDs (use 'id' or 'date' as unique key)
    const localIds = new Set(
      local.map((item) => {
        const i = item as Record<string, unknown>;
        return (i.id as string) || (i.date as string) || JSON.stringify(i);
      })
    );

    const merged = [...local];
    for (const item of cloud) {
      const i = item as Record<string, unknown>;
      const key = (i.id as string) || (i.date as string) || JSON.stringify(i);
      if (!localIds.has(key)) merged.push(item);
    }

    return JSON.stringify(merged);
  } catch {
    return localRaw || (typeof cloudRaw === "string" ? cloudRaw : "[]");
  }
}

const ARRAY_KEYS = new Set([
  "skladai_history",
  "skladai_diary",
  "skladai_weight_history",
  "skladai_strength_records",
  "skladai_measurements",
  "skladai_progress_photos",
  "skladai_biegacz_records",
  "skladai_saved_recipes",
  "skladai_shopping",
  "skladai_expenses",
]);

// ─── public API ───

/** Push current localStorage to Supabase (debounced) */
export function schedulePush(): void {
  if (typeof window === "undefined") return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushToCloud(), 2000);
}

/** Force-push localStorage to cloud NOW */
export async function pushToCloud(): Promise<void> {
  if (typeof window === "undefined" || pushing) return;
  pushing = true;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("[sync] pushToCloud: no user");
      return;
    }

    const payload = collectLocal();
    const keys = Object.keys(payload);
    console.log("[sync] pushToCloud: pushing", keys.length, "keys for user", user.id);

    const { error } = await supabase.from("user_data").upsert({
      user_id: user.id,
      data: payload,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn("[sync] pushToCloud error:", error.message, error.code);
    } else {
      console.log("[sync] pushToCloud: success");
    }
  } catch (e) {
    console.warn("[sync] push failed:", e);
  } finally {
    pushing = false;
  }
}

/** Pull cloud data → merge into localStorage. Returns true if data was restored. */
export async function pullFromCloud(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("[sync] pullFromCloud: no user");
      return false;
    }

    console.log("[sync] pullFromCloud: fetching for user", user.id);
    const { data, error } = await supabase
      .from("user_data")
      .select("data")
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.log("[sync] pullFromCloud: query error:", error.message, error.code);
      return false;
    }
    if (!data?.data) {
      console.log("[sync] pullFromCloud: no cloud data found (first time user)");
      return false;
    }

    const cloud = data.data as Record<string, string>;
    const cloudKeys = Object.keys(cloud).filter(k => cloud[k] !== null && cloud[k] !== undefined);
    console.log("[sync] pullFromCloud: cloud has", cloudKeys.length, "keys:", cloudKeys.join(", "));

    let restored = false;

    for (const key of SYNC_KEYS) {
      const cloudVal = cloud[key];
      if (cloudVal === undefined || cloudVal === null) continue;

      const localVal = localStorage.getItem(key);

      if (!localVal) {
        // Local empty → restore from cloud
        const val = typeof cloudVal === "string" ? cloudVal : JSON.stringify(cloudVal);
        localStorage.setItem(key, val);
        console.log("[sync] restored key:", key);
        restored = true;
      } else if (ARRAY_KEYS.has(key)) {
        // Both exist, merge arrays
        const merged = mergeArrayKey(localVal, cloudVal);
        localStorage.setItem(key, merged);
        restored = true;
      }
      // For non-array keys where local exists — local wins (user may have edited)
    }

    console.log("[sync] pullFromCloud: restored =", restored);
    return restored;
  } catch (e) {
    console.warn("[sync] pull failed:", e);
    return false;
  }
}
