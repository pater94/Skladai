"use client";

import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";

export interface HealthData {
  steps: number;
  kcalBurned: number;
  distanceKm: number;
  isConnected: boolean;
  isNative: boolean;
  loading: boolean;
  requestAccess: () => Promise<void>;
}

const todayStart = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export function useHealthData(): HealthData {
  const [steps, setSteps] = useState(0);
  const [kcalBurned, setKcalBurned] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const isNative = Capacitor.isNativePlatform();

  const fetchData = useCallback(async () => {
    if (!isNative) {
      setLoading(false);
      return;
    }

    try {
      const { Health } = await import("@capgo/capacitor-health");

      const availability = await Health.isAvailable();
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

      // Query today's aggregated data
      const [stepsRes, calRes, distRes] = await Promise.all([
        Health.queryAggregated({ dataType: "steps", startDate, endDate, bucket: "day", aggregation: "sum" }),
        Health.queryAggregated({ dataType: "calories", startDate, endDate, bucket: "day", aggregation: "sum" }),
        Health.queryAggregated({ dataType: "distance", startDate, endDate, bucket: "day", aggregation: "sum" }),
      ]);

      if (stepsRes.samples.length > 0) setSteps(Math.round(stepsRes.samples[0].value));
      if (calRes.samples.length > 0) setKcalBurned(Math.round(calRes.samples[0].value));
      if (distRes.samples.length > 0) setDistanceKm(Math.round((distRes.samples[0].value / 1000) * 10) / 10); // meters → km
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { steps, kcalBurned, distanceKm, isConnected, isNative, loading, requestAccess };
}
