"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHealthData } from "@/lib/useHealthData";

interface ActivityBadgesProps {
  theme?: "dark" | "light";
}

/**
 * Two tiny pills: 👟 steps | 🔥 kcal burned.
 *
 * Client-only: the pill content (steps, kcal, isNative) depends on the
 * browser's Capacitor bridge and hydration would mismatch if we rendered
 * during SSR. We return null on the first paint and render after mount.
 *
 * Click behavior:
 *   - Health not connected OR no data → trigger requestAccess() (or
 *     openSettings on Android if Health Connect is missing).
 *   - Data > 0 → navigate to /dashboard#aktywnosc-dzis.
 */
export default function ActivityBadges({ theme = "dark" }: ActivityBadgesProps) {
  const router = useRouter();
  const health = useHealthData();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const hasData = health.steps > 0 || health.kcalBurned > 0;
  const needsInstall =
    health.platform === "android" && !health.loading && !health.isAvailable;

  const onClick = () => {
    if (health.loading) return;
    // On web there's no native Health SDK — the badges are informational only.
    if (!health.isNative) return;
    if (!hasData || !health.isConnected) {
      try { localStorage.setItem("healthKitAsked", "1"); } catch {}
      if (needsInstall) {
        health.openSettings();
      } else {
        health.requestAccess();
      }
      return;
    }
    router.push("/dashboard#aktywnosc-dzis");
  };

  const isDark = theme === "dark";
  const pillBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const pillBorder = isDark
    ? "1px solid rgba(255,255,255,0.1)"
    : "1px solid rgba(0,0,0,0.08)";
  const emojiOpacity = isDark ? 0.9 : 0.8;

  const stepsText = health.loading ? "—" : health.steps.toLocaleString("pl-PL");
  const kcalText = health.loading ? "—" : String(health.kcalBurned);

  const pillStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "5px 9px",
    borderRadius: "999px",
    background: pillBg,
    border: pillBorder,
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        hasData
          ? `Aktywność dziś: ${health.steps} kroków, ${health.kcalBurned} kcal`
          : "Połącz z aplikacją zdrowia"
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
      }}
    >
      <span style={pillStyle}>
        <span style={{ fontSize: "12px", opacity: emojiOpacity }}>👟</span>
        <span style={{ color: "#6efcb4" }}>{stepsText}</span>
      </span>
      <span style={pillStyle}>
        <span style={{ fontSize: "12px", opacity: emojiOpacity }}>🔥</span>
        <span style={{ color: "#f97316" }}>{kcalText}</span>
      </span>
    </button>
  );
}
