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
    check();
  }, [check]);

  return { isPremium: premium, loading, refresh: check };
}
