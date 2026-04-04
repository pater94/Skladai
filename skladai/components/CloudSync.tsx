"use client";

import { useEffect, useRef } from "react";
import { pullFromCloud, pushToCloud, schedulePush } from "@/lib/sync";
import { createClient } from "@/lib/supabase";

/**
 * Invisible component mounted in root layout.
 * - On mount: if user is logged in, pull cloud data → merge into localStorage → push back
 * - Dispatches "cloud-sync-done" event so pages can re-read state
 * - Listens for "local-data-changed" events to schedule cloud push
 */
export default function CloudSync() {
  const didSync = useRef(false);

  useEffect(() => {
    if (didSync.current) return;
    didSync.current = true;

    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log("[CloudSync] No user logged in, skipping sync");
          return;
        }

        console.log("[CloudSync] User found, pulling from cloud...");
        const restored = await pullFromCloud();
        console.log("[CloudSync] Pull result: restored =", restored);

        // Always push after pull — ensures existing localStorage data reaches the cloud
        // (covers the case where sync was added after user already had data)
        console.log("[CloudSync] Pushing local data to cloud...");
        await pushToCloud();
        console.log("[CloudSync] Push complete");

        // Notify all components to re-read localStorage
        window.dispatchEvent(new Event("cloud-sync-done"));
      } catch (e) {
        console.warn("[CloudSync] sync failed:", e);
      }
    })();
  }, []);

  // Listen for data-change events and push to cloud
  useEffect(() => {
    const handler = () => schedulePush();
    window.addEventListener("local-data-changed", handler);
    return () => window.removeEventListener("local-data-changed", handler);
  }, []);

  return null;
}
