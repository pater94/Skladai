"use client";

import { useEffect, useRef } from "react";
import { pullFromCloud, schedulePush } from "@/lib/sync";
import { createClient } from "@/lib/supabase";

/**
 * Invisible component mounted in root layout.
 * - On mount: if user is logged in, pull cloud data → merge into localStorage
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
        if (!user) return;

        const restored = await pullFromCloud();
        if (restored) {
          // Notify all components to re-read localStorage
          window.dispatchEvent(new Event("cloud-sync-done"));
        }
      } catch {
        // Silent — sync is best-effort
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
