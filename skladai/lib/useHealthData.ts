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

      // Check authorization for all four data types at once.
      // Current @capgo/capacitor-health@8.4.2 supports "sleep" natively
      // on both HealthKit (iOS) and Health Connect (Android), so we
      // don't need the defensive split that used to protect against
      // older plugins that didn't recognise the type.
      const authStatus = await Health.checkAuthorization({
        read: ["steps", "calories", "distance", "sleep"],
      });

      const readAuthorized = authStatus.readAuthorized || [];
      const hasAccess = readAuthorized.length > 0;

      // If we know HealthKit has been asked (readAuthorized has ANY types,
      // regardless of whether user later revoked in Settings), persist a
      // flag so the Połącz-button handler can skip the pointless
      // requestAuthorization on iOS and open Settings directly instead.
      // This covers users who granted perms via a different code path
      // (onboarding, Dashboard CTA) and never touched the Profil button
      // — without it, hasAskedBefore would be false on reconnect and
      // iOS would flash the Settings → Health page then drop them on
      // the app's root Settings entry.
      if (hasAccess) {
        try {
          if (localStorage.getItem("healthKitAsked") !== "1") {
            localStorage.setItem("healthKitAsked", "1");
          }
        } catch {}
      }

      if (!hasAccess) {
        // User revoked all perms in Settings — reset connection state
        // and zero out any previously displayed values so the UI
        // reflects the actual HealthKit/Health Connect status.
        setIsConnected(false);
        setSteps(0);
        setKcalBurned(0);
        setDistanceKm(0);
        setWeekSteps(0);
        setWeekKcalBurned(0);
        setWeekDistanceKm(0);
        setSleepMinutes(0);
        setSleepStart(null);
        setSleepEnd(null);
        setLoading(false);
        return;
      }
      const hasSleepAuth = readAuthorized.includes("sleep");

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

      // Persist a flag the first time we successfully read ANY non-zero
      // data from HealthKit/Health Connect. The Profile card uses this
      // to distinguish 'fresh user who hasn't walked yet today' (zero
      // everything, but never saw data before — stay optimistic, show
      // green 'połączono') from 'established user who just revoked in
      // Settings' (readAuthorized still populated on iOS due to Apple
      // privacy, but now getting zeros — show yellow 'brak danych').
      //
      // iOS HealthKit deliberately cannot report revocation via
      // checkAuthorization for read perms — this flag + data-presence
      // check is the best heuristic we have.
      try {
        const anyNonZeroToday =
          (stepsRes.samples.length > 0 && stepsRes.samples[0].value > 0) ||
          (calRes.samples.length > 0 && calRes.samples[0].value > 0) ||
          (distRes.samples.length > 0 && distRes.samples[0].value > 0);
        if (anyNonZeroToday && localStorage.getItem("healthDataEverSeen") !== "1") {
          localStorage.setItem("healthDataEverSeen", "1");
        }
      } catch {}

      // Sum daily buckets into a week total.
      const sumSamples = (samples: { value: number }[]): number =>
        samples.reduce((acc, s) => acc + (s.value || 0), 0);
      setWeekSteps(Math.round(sumSamples(weekStepsRes.samples)));
      setWeekKcalBurned(Math.round(sumSamples(weekCalRes.samples)));
      setWeekDistanceKm(Math.round((sumSamples(weekDistRes.samples) / 1000) * 10) / 10); // meters → km

      // Sleep: read individual segments from last night window (18:00 yesterday → 12:00 today local).
      // Gated on sleep auth from the unified checkAuthorization above.
      // Wrapped in own try/catch so a sleep failure (e.g. Apple Health
      // returning unexpected data shape) doesn't break the core
      // steps/kcal/distance card that the user already sees.
      if (!hasSleepAuth) {
        setSleepMinutes(0);
        setSleepStart(null);
        setSleepEnd(null);
      } else try {
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

      // Request all four data types in a single prompt so the user sees
      // one unified consent dialog (4 toggles: kroki / kalorie / dystans
      // / sen). The earlier defensive split into two calls caused sleep
      // to appear as a separate prompt much later — bad UX. Current
      // @capgo/capacitor-health@8.4.2 supports "sleep" natively on
      // both HealthKit and Health Connect, so the single call is safe.
      try {
        await Health.requestAuthorization({
          read: ["steps", "calories", "distance", "sleep"],
        });
      } catch (err) {
        // If the combined call throws (hypothetically — e.g. very old
        // bundled plugin), fall back to core three + sleep separately so
        // the user still gets Apple Health unlocked.
        console.warn("[useHealthData] Unified auth failed, retrying split:", err);
        await Health.requestAuthorization({
          read: ["steps", "calories", "distance"],
        });
        try {
          await Health.requestAuthorization({ read: ["sleep"] });
        } catch (sleepErr) {
          console.warn("[useHealthData] Sleep auth retry failed:", sleepErr);
        }
      }

      // Re-fetch after granting permissions
      setLoading(true);
      await fetchData();
    } catch (e) {
      console.warn("[useHealthData] Auth error:", e);
    }
  }, [isNative, fetchData]);

  /**
   * Opens the platform-native settings page where the user can
   * review, revoke, or re-enable individual HealthKit / Health Connect
   * data-type permissions.
   *
   * - Android: @capgo/capacitor-health exposes openHealthConnectSettings()
   *   which deep-links straight to the Health Connect permissions
   *   screen for SkładAI.
   * - iOS (iOS 26.3 behaviour verified on device 2026-04-20):
   *   HealthKit permissions are NOT listed under Settings → SkładAI
   *   any more. Apple moved them to the Health app exclusively:
   *   Zdrowie → Udostępnianie → Aplikacje → SkładAI → toggles.
   *   Opening `app-settings:` drops the user on a useless app
   *   entry that only shows Zdjęcia / Siri / Szukaj / Dane
   *   komórkowe — no way from there to HealthKit. We therefore
   *   open the Apple Health app via the `x-apple-health://` URL
   *   scheme. The confirm dialogs in Profil / ActivityBadges spell
   *   out the exact tap sequence inside the Health app.
   *
   *   HealthKit itself has no API for re-prompting the authorization
   *   dialog once the user has decided (Apple privacy design), so
   *   the Health app path is the only working route.
   */
  const openSettings = useCallback(async () => {
    if (!isNative) return;
    try {
      if (platform === "android") {
        const { Health } = await import("@capgo/capacitor-health");
        await Health.openHealthConnectSettings();
        return;
      }
      if (platform === "ios") {
        // iOS 26.3 blocks every shorter path:
        //   - x-apple-health://sharing  → Apple ignores suffix, opens
        //     Podsumowanie anyway
        //   - App-Prefs:root=Privacy&path=HEALTH → URL scheme silently
        //     dropped (confirmed 2026-04-20 on iPhone 17 Pro iOS 26.3)
        //   - app-settings: → lands on SkładAI's app-level Settings
        //     page which on iOS 26 NO LONGER includes a Zdrowie section
        //     (Apple moved HealthKit perms exclusively to the Health
        //     app / Privacy & Security → Health)
        //
        // Only working deep-link on iOS 26.3 is x-apple-health:// which
        // opens Health app at the Podsumowanie tab. User has to tap
        // Udostępnianie → Aplikacje → SkładAI → toggles. Three taps.
        // Can't do better until Apple ships a dedicated API (they
        // deliberately haven't for a decade on privacy grounds).
        try {
          window.location.href = "x-apple-health://";
        } catch (iosErr) {
          console.warn("[useHealthData] Could not open Apple Health:", iosErr);
        }
      }
    } catch (e) {
      console.warn("[useHealthData] openSettings error:", e);
    }
  }, [isNative, platform]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-check HealthKit/Health Connect authorization whenever the app
  // returns from background. User may have toggled off permissions in
  // iOS Settings → Zdrowie → SkładAI (or Health Connect on Android) —
  // without this listener the app would keep showing "połączono" in
  // Profil and a stale ✅ in ActivityBadges even though HealthKit now
  // refuses reads.
  //
  // We listen on BOTH:
  //   - document.visibilitychange — web-level signal, works on web+native
  //   - @capacitor/app appStateChange — the reliable native signal.
  //     Capacitor emits isActive=true when the app resumes from
  //     background (user coming back from Settings). This fires where
  //     visibilitychange can miss events on some iOS 26 WKWebView builds.
  useEffect(() => {
    if (!isNative) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    let appStateListener: { remove: () => Promise<void> } | null = null;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        appStateListener = await App.addListener("appStateChange", (state) => {
          if (state.isActive) {
            fetchData();
          }
        });
      } catch (e) {
        console.warn("[useHealthData] appStateChange listener failed:", e);
      }
    })();

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (appStateListener) {
        appStateListener.remove().catch(() => undefined);
      }
    };
  }, [isNative, fetchData]);

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
