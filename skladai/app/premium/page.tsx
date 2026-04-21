"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { getOfferings, purchasePackage, restorePurchases } from "@/lib/revenuecat";
import { usePremium } from "@/lib/hooks/usePremium";
import { getGlobalScanCount, FREE_TOTAL_SCANS, activatePremium } from "@/lib/storage";
import { IS_DEMO } from "@/lib/config";

const FEATURES = [
  { icon: "♾️", title: "Nielimitowane skany AI", free: "20 łącznie", premium: "Bez limitu" },
  { icon: "💰", title: "Znajdź najlepszą cenę produktu na Ceneo i Allegro", free: "—", premium: "✓" },
  { icon: "🔍", title: "Szukaj produktów bez szkodliwych składników", free: "—", premium: "✓" },
  { icon: "🎙️", title: "Voice meal", free: "Wliczane do 20", premium: "Bez limitu" },
  { icon: "📊", title: "Dashboard zdrowotny", free: "—", premium: "✓" },
  { icon: "🩸", title: "Panel cukrzyka", free: "—", premium: "✓" },
  { icon: "🤰", title: "Panel ciąży", free: "—", premium: "✓" },
  { icon: "⚠️", title: "Alerty alergenów", free: "Podstawowe", premium: "Rozbudowane" },
  { icon: "🍺", title: "Kalkulator promili", free: "✓", premium: "✓" },
  { icon: "⚔️", title: "Scan Battle", free: "Solo", premium: "Solo + VS" },
  { icon: "📈", title: "Weekly Wrapped", free: "—", premium: "✓" },
  { icon: "🛒", title: "Lista zakupów", free: "—", premium: "✓" },
  { icon: "🥄", title: "Łyżeczki cukru", free: "✓", premium: "✓" },
  { icon: "🔥", title: "Streak & badges", free: "✓", premium: "✓" },
];

// Display labels for package types
const PKG_LABELS: Record<string, { label: string; period: string }> = {
  MONTHLY: { label: "Miesięczny", period: "/mies." },
  ANNUAL: { label: "Roczny", period: "/rok" },
  LIFETIME: { label: "Na zawsze", period: "" },
};

// Order for display — yearly first (default), then monthly, then lifetime
const PKG_ORDER: string[] = ["ANNUAL", "MONTHLY", "LIFETIME"];

// Unified plan shape. `pkg` is null for fallback/hardcoded prices.
type PlanView = {
  id: string;
  typeStr: "MONTHLY" | "ANNUAL" | "LIFETIME";
  priceString: string;
  pricePerMonthString: string | null;
  pkg: PurchasesPackage | null;
};

// Fallback prices shown when RevenueCat offerings aren't available
// (web PWA, or native with a failed getOfferings call).
const FALLBACK_PLANS: PlanView[] = [
  { id: "fallback_annual",   typeStr: "ANNUAL",   priceString: "89,99 zł",  pricePerMonthString: "7,50 zł", pkg: null },
  { id: "fallback_monthly",  typeStr: "MONTHLY",  priceString: "14,99 zł",  pricePerMonthString: null,      pkg: null },
  { id: "fallback_lifetime", typeStr: "LIFETIME", priceString: "199,99 zł", pricePerMonthString: null,      pkg: null },
];

function sortPackages(pkgs: PurchasesPackage[]): PurchasesPackage[] {
  return [...pkgs].sort((a, b) => {
    const aIdx = PKG_ORDER.indexOf(a.packageType as string);
    const bIdx = PKG_ORDER.indexOf(b.packageType as string);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });
}

function packageToView(pkg: PurchasesPackage): PlanView {
  return {
    id: pkg.identifier,
    typeStr: pkg.packageType as PlanView["typeStr"],
    priceString: pkg.product.priceString,
    pricePerMonthString: pkg.product.pricePerMonthString || null,
    pkg,
  };
}

export default function PremiumPage() {
  return (
    <Suspense fallback={null}>
      <PremiumPageInner />
    </Suspense>
  );
}

function PremiumPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const { isPremium: premium, loading: premiumLoading, refresh } = usePremium();
  const isNative = Capacitor.isNativePlatform();

  // Live count of used free scans (refreshed on mount)
  const [scansUsed, setScansUsed] = useState(0);
  useEffect(() => {
    setScansUsed(getGlobalScanCount());
  }, []);

  const [plans, setPlans] = useState<PlanView[]>(FALLBACK_PLANS);
  const [selectedPlan, setSelectedPlan] = useState<PlanView | null>(
    FALLBACK_PLANS.find((p) => p.typeStr === "ANNUAL") || FALLBACK_PLANS[0] || null
  );
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offeringsLoaded, setOfferingsLoaded] = useState(false);

  // Load offerings on mount (native only). Falls back to hardcoded prices on
  // web or when getOfferings fails — Annual stays selected by default.
  useEffect(() => {
    if (!isNative) { setOfferingsLoaded(true); return; }
    getOfferings().then((offering) => {
      if (offering?.availablePackages && offering.availablePackages.length > 0) {
        const sorted = sortPackages(offering.availablePackages).map(packageToView);
        setPlans(sorted);
        const annual = sorted.find((p) => p.typeStr === "ANNUAL");
        setSelectedPlan(annual || sorted[0] || null);
      }
      setOfferingsLoaded(true);
    }).catch(() => setOfferingsLoaded(true));
  }, [isNative]);

  const handlePurchase = async () => {
    if (!selectedPlan || purchasing) return;
    // Fallback plan (no real RC package) — no purchase possible, point user to app stores
    if (!selectedPlan.pkg) {
      setError("Płatności dostępne w aplikacji mobilnej. Pobierz SkładAI z App Store lub Google Play.");
      return;
    }
    setPurchasing(true);
    setError(null);
    try {
      const success = await purchasePackage(selectedPlan.pkg);
      if (success) {
        refresh();
        router.push("/");
      } else {
        setError("Zakup nie został ukończony.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user")) {
        // User cancelled — not an error
      } else {
        setError("Nie udało się przetworzyć płatności. Spróbuj ponownie.");
      }
    }
    setPurchasing(false);
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    try {
      const success = await restorePurchases();
      if (success) {
        refresh();
        router.push("/");
      } else {
        setError("Nie znaleziono wcześniejszych zakupów.");
      }
    } catch {
      setError("Nie udało się przywrócić zakupów.");
    }
    setRestoring(false);
  };

  if (premiumLoading || !offeringsLoaded) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F2EB] flex items-center justify-center">
        <div style={{ width: 40, height: 40, border: "4px solid rgba(245,158,11,0.3)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spinSlow 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5F2EB]">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/10 blur-[60px]" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-white/10 blur-[60px]" />
        <div className="max-w-md mx-auto px-5 pt-6 pb-24 relative z-10">
          <button onClick={() => router.back()}
            className="flex items-center gap-2 text-[13px] text-white/80 font-semibold px-4 py-2 rounded-full bg-white/10 border border-white/20 active:scale-95 transition-all mb-6">
            ← Powrót
          </button>
          <div className="text-center">
            <span className="text-5xl block mb-3">👑</span>
            <h1 className="text-[28px] font-black text-white">SkładAI Premium</h1>
            <p className="text-white/70 text-[14px] mt-2 font-medium">Pełna kontrola nad tym co jesz</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 -mt-14 pb-24 relative z-20">
        {/* NOTE: previously had a separate "⏳ Wykorzystałeś X darmowych
            skanów" banner here for reason === "limit" — removed because
            it visually overlapped the orange header → white section
            seam AND duplicated the information already carried by the
            progress bar below (red fill at 20/20). The header already
            says "SkładAI Premium"; the card below says "20/20" in red.
            That's enough. */}

        {/* Usage counter + progress bar — visible to non-premium users */}
        {!premium && (
          <div className="card-elevated rounded-[20px] p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-gray-600">Darmowe skany AI</span>
              <span className="text-[12px] font-bold" style={{ color: scansUsed >= FREE_TOTAL_SCANS ? "#dc2626" : scansUsed >= FREE_TOTAL_SCANS - 5 ? "#f59e0b" : "#22c55e" }}>
                {Math.min(scansUsed, FREE_TOTAL_SCANS)} / {FREE_TOTAL_SCANS}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, (scansUsed / FREE_TOTAL_SCANS) * 100)}%`,
                background: scansUsed >= FREE_TOTAL_SCANS
                  ? "linear-gradient(90deg,#ef4444,#dc2626)"
                  : scansUsed >= FREE_TOTAL_SCANS - 5
                  ? "linear-gradient(90deg,#f59e0b,#f97316)"
                  : "linear-gradient(90deg,#22c55e,#16a34a)",
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        )}

        {/* Active premium status */}
        {premium && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-[20px] p-5 mb-4 text-center">
            <p className="text-[16px] font-bold text-emerald-700">✅ Premium aktywne!</p>
            <p className="text-[12px] text-emerald-600 mt-1">Masz pełen dostęp do wszystkich funkcji.</p>
          </div>
        )}

        {/* ── PLAN CARDS + CTA (shown on native with offerings OR with
             fallback prices when offerings unavailable; also visible on web
             for transparency about pricing, but CTA becomes a download
             prompt there) ── */}
        {!premium && (
          <div className="card-elevated rounded-[24px] p-6 mb-4">
            {/* Plan cards */}
            <div className="space-y-3 mb-5">
              {plans.map((plan) => {
                const info = PKG_LABELS[plan.typeStr];
                const isSelected = selectedPlan?.id === plan.id;
                const isAnnual = plan.typeStr === "ANNUAL";
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className="w-full text-left relative rounded-[16px] p-4 transition-all"
                    style={{
                      background: isSelected ? "rgba(245,158,11,0.08)" : "rgba(0,0,0,0.02)",
                      border: isSelected ? "2px solid #f59e0b" : "2px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    {isAnnual && (
                      <span className="absolute -top-2.5 right-3 text-[9px] font-black text-white bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        Najlepszy wybór
                      </span>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="ml-7">
                        <p className="text-[14px] font-bold text-[#1A3A0A]">{info.label}</p>
                        {isAnnual && plan.pricePerMonthString && (
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {plan.pricePerMonthString}/mies.
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[18px] font-black text-[#1A3A0A]">{plan.priceString}</p>
                        {info.period && <p className="text-[11px] text-gray-400">{info.period}</p>}
                      </div>
                    </div>
                    {/* Selection indicator */}
                    <div className="absolute top-4 left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      style={{ borderColor: isSelected ? "#f59e0b" : "rgba(0,0,0,0.15)" }}>
                      {isSelected && <div className="w-3 h-3 rounded-full bg-amber-500" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* CTA — dynamic price of selected plan */}
            <button
              onClick={handlePurchase}
              disabled={purchasing || !selectedPlan}
              className="w-full py-4 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-white font-bold rounded-[18px] active:scale-[0.97] transition-all text-[15px] shadow-xl shadow-orange-500/25 mb-3 disabled:opacity-50"
            >
              {purchasing
                ? "Przetwarzanie..."
                : selectedPlan
                ? `Rozpocznij — ${selectedPlan.priceString}${PKG_LABELS[selectedPlan.typeStr].period}`
                : "Rozpocznij"}
            </button>

            {IS_DEMO && (
              <button
                onClick={() => {
                  activatePremium(3650);
                  // Broadcast so every usePremium() consumer (AgentFAB,
                  // ScanLimitBanner, this page's own hook) re-checks in
                  // place. The redirect to /dashboard was a blunt way
                  // to force a re-mount; with the hook listener we can
                  // stay on the page and it simply flips to "Premium
                  // aktywny" without any navigation jank.
                  window.dispatchEvent(new Event("premium-changed"));
                  router.push("/dashboard");
                }}
                style={{
                  width: "100%",
                  padding: 12,
                  background: "rgba(245,158,11,0.1)",
                  border: "1px dashed #f59e0b",
                  borderRadius: 12,
                  color: "#f59e0b",
                  fontSize: 13,
                  fontWeight: 700,
                  marginTop: 10,
                  cursor: "pointer",
                }}
              >
                🧪 Aktywuj Premium DEMO (bez płatności)
              </button>
            )}

            {/* Native-only: restore purchases */}
            {isNative && (
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="w-full py-2 text-[12px] text-gray-400 font-semibold"
              >
                {restoring ? "Przywracanie..." : "Przywróć zakupy"}
              </button>
            )}

            {/* Web-only: download prompt + store links */}
            {!isNative && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                <p className="text-[12px] font-bold text-[#1A3A0A] mb-2">📱 Płatności dostępne w aplikacji mobilnej</p>
                <div className="flex gap-3 justify-center">
                  <a href="#" className="px-4 py-2 rounded-[12px] bg-black text-white text-[12px] font-bold"> App Store</a>
                  <a href="#" className="px-4 py-2 rounded-[12px] bg-black text-white text-[12px] font-bold"> Google Play</a>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-[12px] text-red-500 text-center mt-2">{error}</p>
            )}
          </div>
        )}

        {/* Feature comparison */}
        <div className="card-elevated rounded-[24px] p-5">
          <h2 className="text-[16px] font-bold text-[#1A3A0A] mb-4">Porównanie planów</h2>

          <div className="flex items-center gap-2 pb-3 border-b border-gray-100 mb-2">
            <div className="flex-1" />
            <div className="w-16 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Free</p>
            </div>
            <div className="w-16 text-center">
              <p className="text-[10px] font-bold text-amber-500 uppercase">Premium</p>
            </div>
          </div>

          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-center gap-2 py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-[14px] w-6">{f.icon}</span>
              <span className="flex-1 text-[12px] font-medium text-gray-600">{f.title}</span>
              <span className="w-16 text-center text-[11px] text-gray-400 font-semibold">{f.free}</span>
              <span className="w-16 text-center text-[11px] text-emerald-600 font-bold">{f.premium}</span>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="card-elevated rounded-[24px] p-5 mt-4">
          <p className="text-[13px] font-bold text-[#1A3A0A] mb-3">💬 Co mówią użytkownicy</p>
          <div className="space-y-3">
            {[
              { text: "Odkąd mam Premium, oszczędzam ~150 zł miesięcznie na śmieciowym jedzeniu.", author: "Kasia, 28 lat" },
              { text: "Panel cukrzyka zmienił moje podejście do WW. Nie wyobrażam sobie bez tego.", author: "Marek, 45 lat" },
              { text: "Scan Battle na imprezach to hit. Wszyscy pytają o tę apkę!", author: "Tomek, 23 lata" },
            ].map((t, i) => (
              <div key={i} className="bg-gray-50 rounded-[14px] p-3">
                <p className="text-[12px] text-gray-600 italic">&ldquo;{t.text}&rdquo;</p>
                <p className="text-[10px] text-gray-400 mt-1 font-semibold">— {t.author}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[9px] text-gray-300 text-center mt-4 px-4">
          SkładAI nie jest wyrobem medycznym. Premium nie zmienia dokładności analizy — daje dostęp do dodatkowych narzędzi.
        </p>
      </div>
    </div>
  );
}
