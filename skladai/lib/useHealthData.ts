"use client";

import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";

export interface HealthData {
  steps: number;
  kcalBurned: number;
  distanceKm: number;
  /** Aggregated totals for the last 7 days (today inclusive). */
  weekSteps: number;
  weekKcalBurned: number;
  weekDistanceKm: number;
  /** Minutes of sleep from last night's window (18:00 yesterday → 12:00 today local). 0 if no data. */
  sleepMinutes: number;
  /** ISO 8601 timestamp of earliest sleep sample in the window, or null when no data. */
  sleepStart: string | null;
  /** ISO 8601 timestamp of latest sleep sample in the window, or null when no data. */
  sleepEnd: string | null;
  isConnected: boolean;
  isNative: boolean;
  /** 'ios' | 'android' | 'web' — useful for platform-specific labels. */
  platform: "ios" | "android" | "web";
  /** Native SDK availability (e.g. false on Android when Health Connect is missing). */
  isAvailable: boolean;
  loading: boolean;
  requestAccess: () => Promise<void>;
  /** Opens Health Connect settings on Android (no-op on iOS). */
  openSettings: () => Promise<void>;
}

const todayStart = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

/** Sleep window: 18:00 local yesterday → 12:00 local today. */
const lastNightWindow = (): { start: string; end: string } => {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(18, 0, 0, 0);
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
};

/**
 * Robust platform detection.
 *
 * Capacitor.getPlatform() is authoritative inside a native shell, but we've
 * seen cases where it returns "web" while the user is actually on a native
 * device (e.g. the Capacitor bridge not being ready yet on first render,
 * remote-URL shells, or a stale cached runtime). Fall back to a user-agent
 * sniff so Android users never see "Apple Health" labels.
 */
function detectPlatform(): "ios" | "android" | "web" {
  const cap = Capacitor.getPlatform();
  if (cap === "ios" || cap === "android") return cap;
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent || "";
    if (/android/i.test(ua)) return "android";
    if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  }
  return "web";
}

export function useHealthData(): HealthData {
  const [steps, setSteps] = useState(0);
  const [kcalBurned, setKcalBurned] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [weekSteps, setWeekSteps] = useState(0);
  const [weekKcalBurned, setWeekKcalBurned] = useState(0);
  const [weekDistanceKm, setWeekDistanceKm] = useState(0);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [sleepStart, setSleepStart] = useState<string | null>(null);
  const [sleepEnd, setSleepEnd] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const isNative = Capacitor.isNativePlatform();
  const platform = detectPlatform();

  const fetchData = useCallback(async () => {
    if (!isNative) {
      setLoading(false);
      return;
    }

    try {
      const { Health } = await import("@capgo/capacitor-health");

      const availability = await Health.isAvailable();
      setIsAvailable(availability.available);
      if (!availability.available) {
        setLoading(false);
        return;
      }

      // Check if we already have authorization for the core three types.
      // Sleep is checked / requested SEPARATELY below — if we add "sleep"
      // into this array and the native plugin bundled in an older IPA
      // doesn't know the type, the whole call throws and kills Apple
      // Health for this user.
      const authStatus = await Health.checkAuthorization({
        read: ["steps", "calories", "distance"],
      });

      const hasAccess = authStatus.readAuthorized.length > 0;
      if (!hasAccess) {
        setLoading(false);
        return;
      }

      setIsConnected(true);

      const startDate = todayStart();
      const endDate = new Date().toISOString();

      // Last 7 days inclusive (today minus 6 days, midnight).
      const weekStartDate = new Date();
      weekStartDate.setHours(0, 0, 0, 0);
      weekStartDate.setDate(weekStartDate.getDate() - 6);
      const weekStart = weekStartDate.toISOString();

      // Query today's + last-7-days aggregated data in parallel.
      const [
        stepsRes,
        calRes,
        distRes,
        weekStepsRes,
        weekCalRes,
        weekDistRes,
      ] = await Promise.all([
        Health.queryAggregated({ dataType: "steps", startDate, endDate, bucket: "day", aggregation: "sum" }),
        Health.queryAggregated({ dataType: "calories", startDate, endDate, bucket: "day", aggregation: "sum" }),
        Health.queryAggregated({ dataType: "distance", startDate, endDate, bucket: "day", aggregation: "sum" }),
        Health.queryAggregated({ dataType: "steps", startDate: weekStart, endDate, bucket: "day", aggregation: "sum" }),
        Health.queryAggregated({ dataType: "calories", startDate: weekStart, endDate, bucket: "day", aggregation: "sum" }),
        Health.queryAggregated({ dataType: "distance", startDate: weekStart, endDate, bucket: "day", aggregation: "sum" }),
      ]);

      if (stepsRes.samples.length > 0) setSteps(Math.round(stepsRes.samples[0].value));
      if (calRes.samples.length > 0) setKcalBurned(Math.round(calRes.samples[0].value));
      if (distRes.samples.length > 0) setDistanceKm(Math.round((distRes.samples[0].value / 1000) * 10) / 10); // meters → km

      // Sum daily buckets into a week total.
      const sumSamples = (samples: { value: number }[]): number =>
        samples.reduce((acc, s) => acc + (s.value || 0), 0);
      setWeekSteps(Math.round(sumSamples(weekStepsRes.samples)));
      setWeekKcalBurned(Math.round(sumSamples(weekCalRes.samples)));
      setWeekDistanceKm(Math.round((sumSamples(weekDistRes.samples) / 1000) * 10) / 10); // meters → km

      // Sleep: read individual segments from last night window (18:00 yesterday → 12:00 today local).
      // Wrapped in its own try/catch so a sleep failure doesn't break steps/kcal/distance above.
      // We also gate the readSamples call with an isolated authorization
      // check — this way if the plugin doesn't know the "sleep" data type
      // at all, the throw is contained here and never reaches the outer
      // try that handles the core three types.
      try {
        const sleepAuth = await Health.checkAuthorization({ read: ["sleep"] });
        const hasSleepAccess = sleepAuth.readAuthorized.length > 0;
        if (!hasSleepAccess) {
          setSleepMinutes(0);
          setSleepStart(null);
          setSleepEnd(null);
          // fall through — readSamples would fail without auth anyway.
          throw new Error("no-sleep-auth");
        }
        const { start: night18y, end: noon12t } = lastNightWindow();
        const sleepRes = await Health.readSamples({
          dataType: "sleep",
          startDate: night18y,
          endDate: noon12t,
          limit: 200,
        });

        // Prefer categorised stages (asleep/rem/deep/light); skip inBed and awake.
        // If no sample carries sleepState (some sources don't classify), fall back
        // to all returned segments — better an approximate total than nothing.
        const ASLEEP_STATES = new Set(["asleep", "rem", "deep", "light"]);
        const allSamples = sleepRes.samples || [];
        const categorised = allSamples.filter(
          (s) => s.sleepState && ASLEEP_STATES.has(s.sleepState)
        );
        const usable =
          categorised.length > 0
            ? categorised
            : allSamples.filter((s) => !s.sleepState || s.sleepState !== "awake");

        if (usable.length > 0) {
          let totalMs = 0;
          let earliest = Number.POSITIVE_INFINITY;
          let latest = 0;
          for (const s of usable) {
            const startMs = new Date(s.startDate).getTime();
            const endMs = new Date(s.endDate).getTime();
            if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
              totalMs += endMs - startMs;
              if (startMs < earliest) earliest = startMs;
              if (endMs > latest) latest = endMs;
            }
          }
          setSleepMinutes(Math.round(totalMs / 60000));
          setSleepStart(Number.isFinite(earliest) ? new Date(earliest).toISOString() : null);
          setSleepEnd(latest > 0 ? new Date(latest).toISOString() : null);
        } else {
          setSleepMinutes(0);
          setSleepStart(null);
          setSleepEnd(null);
        }
      } catch (sleepErr) {
        console.warn("[useHealthData] Sleep query failed:", sleepErr);
      }
    } catch (e) {
      console.warn("[useHealthData] Error:", e);
    } finally {
      setLoading(false);
    }
  }, [isNative]);

  const requestAccess = useCallback(async () => {
    if (!isNative) return;
    try {
      const { Health } = await import("@capgo/capacitor-health");

      const availability = await Health.isAvailable();
      if (!availability.available) return;

      // Request the core three types first. This is the call whose success
      // unlocks the "Aktywność dziś" card — it must never be blocked by
      // an older plugin that doesn't know about "sleep".
      await Health.requestAuthorization({
        read: ["steps", "calories", "distance"],
      });

      // Request sleep separately so a plugin that doesn't support it
      // can't poison the main permission flow.
      try {
        await Health.requestAuthorization({ read: ["sleep"] });
      } catch (sleepAuthErr) {
        console.warn("[useHealthData] Sleep authorization request failed:", sleepAuthErr);
      }

      // Re-fetch after granting permissions
      setLoading(true);
      await fetchData();
    } catch (e) {
      console.warn("[useHealthData] Auth error:", e);
    }
  }, [isNative, fetchData]);

  const openSettings = useCallback(async () => {
    if (!isNative) return;
    try {
      const { Health } = await import("@capgo/capacitor-health");
      await Health.openHealthConnectSettings();
    } catch (e) {
      console.warn("[useHealthData] openSettings error:", e);
    }
  }, [isNative]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    steps,
    kcalBurned,
    distanceKm,
    weekSteps,
    weekKcalBurned,
    weekDistanceKm,
    sleepMinutes,
    sleepStart,
    sleepEnd,
    isConnected,
    isNative,
    platform,
    isAvailable,
    loading,
    requestAccess,
    openSettings,
  };
}
