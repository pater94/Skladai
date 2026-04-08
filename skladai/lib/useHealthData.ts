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

      // Check if we already have authorization
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

      await Health.requestAuthorization({
        read: ["steps", "calories", "distance"],
      });

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
    isConnected,
    isNative,
    platform,
    isAvailable,
    loading,
    requestAccess,
    openSettings,
  };
}
