"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkFreeTierLimit, FREE_TOTAL_SCANS } from "@/lib/storage";
import { usePremium } from "@/lib/hooks/usePremium";

/**
 * Soft banner shown on scan result pages when the free user is close to
 * hitting the 20-scan global limit. Visible only when 15 ≤ used < 20 and
 * user is not premium. Clickable — routes to /premium.
 */
export default function ScanLimitBanner() {
  const router = useRouter();
  const { isPremium, loading } = usePremium();
  const [mounted, setMounted] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [used, setUsed] = useState(0);

  useEffect(() => {
    setMounted(true);
    const r = checkFreeTierLimit();
    setRemaining(r.remaining);
    setUsed(r.used);
  }, []);

  if (!mounted || loading) return null;
  if (isPremium) return null;

  const threshold = FREE_TOTAL_SCANS - 5; // 15
  if (used < threshold || used >= FREE_TOTAL_SCANS) return null;

  return (
    <div style={{ margin: "0 16px 10px" }}>
      <button
        type="button"
        onClick={() => router.push("/premium")}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 12,
          background: "rgba(251,191,36,0.08)",
          border: "1px solid rgba(251,191,36,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "#FBBF24" }}>
          ⚡ Zostało Ci {remaining} {remaining === 1 ? "darmowy skan" : remaining < 5 ? "darmowe skany" : "darmowych skanów"}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(251,191,36,0.75)" }}>
          Zobacz Premium →
        </span>
      </button>
    </div>
  );
}
