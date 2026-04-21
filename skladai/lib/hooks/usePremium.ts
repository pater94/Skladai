"use client";

import { useState, useEffect, useCallback } from "react";
import { checkPremium } from "@/lib/revenuecat";
import { isPremium as isLocalPremium } from "@/lib/storage";

interface UsePremiumResult {
  isPremium: boolean;
  loading: boolean;
  refresh: () => void;
}

/**
 * Hook that checks premium status via RevenueCat (native) with
 * localStorage fallback (web). Caches result in state.
 *
 * Listens to the `premium-changed` window event so any code that
 * mutates the premium status (RevenueCat purchase, DEMO activation,
 * DEMO deactivation, logout) can broadcast and this hook re-checks
 * without requiring a reload or route change. Every DEMO button in
 * the app fires this event after writing to localStorage — if the
 * hook doesn't listen, the UI stays stale until the next mount.
 */
export function usePremium(): UsePremiumResult {
  const [premium, setPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      // RevenueCat (native only — returns false on web)
      const rc = await checkPremium();
      if (rc) {
        setPremium(true);
        setLoading(false);
        return;
      }
    } catch {
      // RC unavailable — fall through to localStorage
    }
    // Fallback: localStorage-based premium (demo / web)
    setPremium(isLocalPremium());
    setLoading(false);
  }, []);

  useEffect(() => {
    // Initial check on mount. check() is async and sets state when
    // it resolves — this is the standard pattern for fetching from
    // async external sources (RevenueCat SDK + localStorage). The
    // lint rule below is about cascading sync-setState, which
    // doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check();

    // Broadcast-based refresh: DEMO buttons, purchase callbacks, and
    // logout handlers dispatch "premium-changed" after mutating state.
    // We re-run check() so every consumer of usePremium updates in
    // place — no reload, no onClose(), no route push.
    const handler = () => { check(); };
    if (typeof window !== "undefined") {
      window.addEventListener("premium-changed", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("premium-changed", handler);
      }
    };
  }, [check]);

  return { isPremium: premium, loading, refresh: check };
}
