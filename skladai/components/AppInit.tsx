"use client";

import { useEffect } from "react";
import { initRevenueCat } from "@/lib/revenuecat";

/** One-time app initialization (RevenueCat, etc.). Renders nothing. */
export default function AppInit() {
  useEffect(() => {
    initRevenueCat().catch(() => {
      // RevenueCat init failed — not critical, premium checks will return false
    });
  }, []);

  return null;
}
