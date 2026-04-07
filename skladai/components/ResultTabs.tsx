"use client";

import { useEffect, useState } from "react";
import { AnalysisResult, FoodAnalysisResult, CosmeticsAnalysisResult, CosmeticWarning, ScanMode, SupplementAnalysisResult } from "@/lib/types";
import IngredientCard from "./IngredientCard";
import CosmeticIngredientCard from "./CosmeticIngredientCard";
import NutritionTable from "./NutritionTable";

const foodTabs = [
  { id: "ingredients", icon: "🧪", label: "Skład" },
  { id: "nutrition", icon: "📊", label: "Wartości" },
  { id: "review", icon: "⚖️", label: "Ocena" },
] as const;

const cosmeticsTabs = [
  { id: "alternatives", icon: "💰", label: "Alternatywy" },
  { id: "review", icon: "⚕️", label: "Ocena" },
  { id: "ingredients", icon: "🧪", label: "Skład" },
] as const;

const supplementTabs = [
  { id: "alternatives", icon: "💰", label: "Alternatywy" },
  { id: "review", icon: "⚖️", label: "Ocena" },
  { id: "ingredients", icon: "💊", label: "Skład" },
] as const;

type TabId = "ingredients" | "nutrition" | "alternatives" | "review" | "interactions";

interface Props {
  result: AnalysisResult;
  scanType?: ScanMode;
  isCosmetics?: boolean;
  onIngredientClick?: (name: string) => void;
}

// Helper: normalize warning to object form
function normalizeWarning(w: CosmeticWarning | string): CosmeticWarning {
  if (typeof w === "string") return { text: w, level: "caution", pregnancy_risk: false };
  return w;
}

// Fallback URL builders (used while loading or if API fails)
function ceneoSearchUrl(name: string) {
  return `https://www.ceneo.pl/szukaj-${encodeURIComponent(name).replace(/%20/g, "-")}`;
}
function allegroSearchUrl(name: string) {
  return `https://allegro.pl/listing?string=${encodeURIComponent(name)}`;
}

interface PriceSearchResponse {
  ceneo: { found: boolean; name?: string; price?: number; url?: string; searchUrl: string };
  allegro: { found: boolean; name?: string; price?: number; url?: string; searchUrl: string };
}

// Format price as whole złoty if integer-ish, otherwise 2 decimals.
function fmtPrice(p: number): string {
  return Number.isInteger(p) ? `${p} zł` : `${p.toFixed(2)} zł`;
}

// Shopping links — fetches Ceneo + Allegro product/search links via /api/price-search.
// Renders skeleton while loading, then real prices when API returns.
// `category` is kept for prop compatibility but not sent (server doesn't need it).
function ShoppingLinks({ name }: { name: string; category?: "cosmetic" | "supplement" }) {
  const [data, setData] = useState<PriceSearchResponse | null>(null);
  // Start as loading only when we actually have a name to query.
  const [loading, setLoading] = useState<boolean>(() => !!name);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    fetch("/api/price-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productName: name }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        if (json) setData(json as PriceSearchResponse);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  // Skeleton state — pulsing placeholders while we wait for prices.
  if (loading) {
    return (
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{
              flex: 1,
              height: 38,
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
        ))}
      </div>
    );
  }

  const ceneo = data?.ceneo;
  const allegro = data?.allegro;
  const ceneoHref = ceneo?.found ? ceneo.url! : ceneo?.searchUrl || ceneoSearchUrl(name);
  const allegroHref = allegro?.found ? allegro.url! : allegro?.searchUrl || allegroSearchUrl(name);
  const noPrices = !ceneo?.found && !allegro?.found;

  return (
    <div>
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      {/* Ceneo */}
      <a
        href={ceneoHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: 10,
          borderRadius: 10,
          background: "rgba(232,56,13,0.08)",
          border: "1px solid rgba(232,56,13,0.2)",
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        <div style={{ width: 18, height: 18, borderRadius: 5, background: "#e8380d", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "white", fontSize: 8, fontWeight: 700 }}>C</span>
        </div>
        <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 500 }}>
          {ceneo?.found && ceneo.price ? `Ceneo · ${fmtPrice(ceneo.price)}` : "Ceneo"}
        </span>
      </a>

      {/* Allegro */}
      <a
        href={allegroHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: 10,
          borderRadius: 10,
          background: "rgba(255,90,0,0.08)",
          border: "1px solid rgba(255,90,0,0.2)",
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        <div style={{ width: 18, height: 18, borderRadius: 5, background: "#ff5a00", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "white", fontSize: 8, fontWeight: 700 }}>A</span>
        </div>
        <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 500 }}>
          {allegro?.found && allegro.price ? `Allegro · ${fmtPrice(allegro.price)}` : "Allegro"}
        </span>
      </a>
    </div>
    {noPrices && (
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center", margin: "6px 0 0" }}>
        Sprawdź aktualną cenę
      </p>
    )}
    </div>
  );
}

export default function ResultTabs({ result, scanType = "food", isCosmetics: isCosProp, onIngredientClick }: Props) {
  const isInitCosmetics = isCosProp ?? scanType === "cosmetics";
  const isInitSuplement = scanType === "suplement";
  const [active, setActive] = useState<TabId>(isInitCosmetics || isInitSuplement ? "alternatives" : "ingredients");
  const [selectedAlt, setSelectedAlt] = useState<"cheaper" | "better" | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const isCosmetics = isCosProp ?? scanType === "cosmetics";
  const isSuplement = scanType === "suplement" || result.type === "suplement";
  const tabs = isSuplement ? supplementTabs : isCosmetics ? cosmeticsTabs : foodTabs;

  const cosResult = isCosmetics ? result as CosmeticsAnalysisResult : null;
  const suppResult = isSuplement ? result as SupplementAnalysisResult : null;

  return (
    <div>
      {/* Tab bar */}
      <div className={`rounded-[14px] p-1 mb-3 ${isCosmetics || isSuplement ? "velvet-card" : "glass-card"}`}>
        <div className="flex gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id as TabId)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-[10px] transition-all duration-300 ${
                active === tab.id
                  ? isSuplement
                    ? "text-white shadow-md"
                    : isCosmetics
                    ? "bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-md shadow-purple-500/20"
                    : "bg-[#1A3A0A] text-white shadow-md"
                  : isCosmetics || isSuplement ? "text-white/40" : "text-gray-400"
              }`}
              style={active === tab.id && isSuplement ? { background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" } : {}}
            >
              <span className="text-[12px]">{tab.icon}</span>
              <span className="text-[11px] font-bold">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="anim-fade-scale" key={active}>

        {/* ══ TAB: SKŁAD (food) ══ */}
        {active === "ingredients" && !isCosmetics && !isSuplement && (
          <div className="space-y-2.5">
            {(result as FoodAnalysisResult).ingredients?.map((ing, i) => (
              <IngredientCard key={i} ingredient={ing} onIngredientClick={onIngredientClick} />
            ))}
          </div>
        )}

        {/* ══ TAB: SKŁAD (cosmetics) ══ */}
        {active === "ingredients" && isCosmetics && cosResult && (
          <div className="space-y-3">
            {/* Ingredient stats bar */}
            <div className="velvet-card rounded-[20px] p-4">
              <div className="flex justify-between text-center">
                <div>
                  <p className="text-[22px] font-bold text-white">{cosResult.ingredient_count || cosResult.ingredients?.length || 0}</p>
                  <p className="text-[10px] mt-0.5 font-semibold text-white/55">Składników</p>
                </div>
                <div>
                  <p className="text-[22px] font-bold text-emerald-400">{cosResult.safe_count ?? 0}</p>
                  <p className="text-[10px] mt-0.5 font-semibold text-white/55">Bezpieczne</p>
                </div>
                <div>
                  <p className="text-[22px] font-bold text-amber-400">{cosResult.caution_count ?? 0}</p>
                  <p className="text-[10px] mt-0.5 font-semibold text-white/55">Uwaga</p>
                </div>
                <div>
                  <p className="text-[22px] font-bold text-red-400">{cosResult.harmful_count ?? 0}</p>
                  <p className="text-[10px] mt-0.5 font-semibold text-white/55">Ryzyko</p>
                </div>
              </div>
              {/* Safety bar */}
              {cosResult.ingredient_count > 0 && (
                <div className="flex rounded-full overflow-hidden h-2 mt-3 gap-0.5">
                  <div className="bg-emerald-500 rounded-full" style={{ flex: cosResult.safe_count ?? 0 }} />
                  <div className="bg-amber-400 rounded-full" style={{ flex: cosResult.caution_count ?? 0 }} />
                  <div className="bg-red-500 rounded-full" style={{ flex: cosResult.harmful_count ?? 0 }} />
                </div>
              )}
            </div>

            {/* Ingredient list */}
            <div className="space-y-2">
              {cosResult.ingredients?.map((ing, i) => (
                <CosmeticIngredientCard key={i} ingredient={ing} isCosmetics />
              ))}
            </div>

            {/* Warto wiedzieć */}
            {cosResult.fun_comparisons && cosResult.fun_comparisons.length > 0 && (
              <div className="velvet-card rounded-[20px] p-5">
                <p className="text-[11px] font-bold text-purple-400/70 uppercase tracking-widest mb-3">💡 Warto wiedzieć</p>
                <ul className="space-y-2">
                  {cosResult.fun_comparisons.map((c, i) => (
                    <li key={i} className="text-[12px] text-white/55 leading-relaxed">{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: WARTOŚCI (food only) ══ */}
        {active === "nutrition" && !isCosmetics && !isSuplement && (
          <NutritionTable items={(result as FoodAnalysisResult).nutrition} />
        )}

        {/* ══ TAB: ALTERNATYWY (cosmetics) ══ */}
        {active === "alternatives" && isCosmetics && cosResult && (() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const alt = (cosResult as any).alternatives || cosResult.price_comparison;
          const cheaper = alt?.cheaper || null;
          const better = alt?.better || null;
          const comparison = alt?.comparison || [];
          const altVerdict = alt?.verdict || "";
          const tip = alt?.tip || alt?.savings_tip || "";
          return (
          <div className="space-y-3">
            {/* Mini hook */}
            {(cheaper || better) && (
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, textAlign: "center", margin: "0 0 14px" }}>
                💸 AI znalazł lepsze opcje z tym samym składem
              </p>
            )}

            {/* Best choice card — when no alternatives needed */}
            {!cheaper && !better && (
              <div className="rounded-[20px] p-5" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🏆</span>
                  <h3 className="text-[18px] font-black" style={{ color: "#22c55e" }}>Najlepszy wybór!</h3>
                </div>
                <p className="text-[12px] text-white/55 leading-relaxed mt-2">{altVerdict || "Świetny wybór! Ten produkt ma dobry skład. Nie znaleźliśmy lepszej opcji."}</p>
                {tip && (
                  <div className="flex items-start gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-sm">💡</span>
                    <p className="text-[11px] text-white/55 leading-relaxed">{tip}</p>
                  </div>
                )}
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[11px] font-bold text-white/55 uppercase tracking-widest mb-2">🛒 Gdzie kupić najtaniej</p>
                  <ShoppingLinks name={cosResult.name || ""} category="cosmetic" />
                </div>
              </div>
            )}

            {/* Karta Tańsza opcja */}
            {cheaper && (
              <div onClick={() => setSelectedAlt(selectedAlt === "cheaper" ? null : "cheaper")} className={`rounded-[20px] p-5 transition-all cursor-pointer ${selectedAlt === "cheaper" ? "ring-2 ring-emerald-400/50" : ""}`} style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">🟢 Tańsza opcja</span>
                  {selectedAlt === "cheaper" && <span className="text-emerald-400">✅</span>}
                </div>
                <div className="flex items-center gap-3">
                  {cheaper.score && (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0" style={{ background: cheaper.score >= 7 ? "#22c55e" : cheaper.score >= 4 ? "#f59e0b" : "#ef4444" }}>
                      {cheaper.score}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-white/90">{cheaper.name}</p>
                    <p className="text-[11px] text-white/55 mt-0.5">{cheaper.reason}</p>
                  </div>
                </div>
                <ShoppingLinks name={cheaper.search_query || cheaper.name} category="cosmetic" />
              </div>
            )}

            {/* Karta Lepszy skład */}
            {better && (
              <div onClick={() => setSelectedAlt(selectedAlt === "better" ? null : "better")} className={`rounded-[20px] p-5 transition-all cursor-pointer ${selectedAlt === "better" ? "ring-2 ring-purple-400/50" : ""}`} style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-purple-400 uppercase tracking-widest">⭐ Lepszy skład</span>
                  <div className="flex items-center gap-1.5">
                    {better.score && <span className="text-[12px] font-bold text-purple-400">{better.score}/10</span>}
                    {selectedAlt === "better" && <span className="text-purple-400">✅</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {better.score && (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0" style={{ background: better.score >= 7 ? "#22c55e" : better.score >= 4 ? "#f59e0b" : "#ef4444" }}>
                      {better.score}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-white/90">{better.name}</p>
                    <p className="text-[11px] text-white/55 mt-0.5">{better.reason}</p>
                  </div>
                </div>
                {better.advantages && better.advantages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    {better.advantages.map((a: string, i: number) => (
                      <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-full bg-purple-500/10 text-purple-300">{a}</span>
                    ))}
                  </div>
                )}
                <ShoppingLinks name={better.search_query || better.name} category="cosmetic" />
              </div>
            )}

            {/* Porównanie składników (akordeon) */}
            {comparison.length > 0 && (
              <div className="velvet-card rounded-[20px] overflow-hidden">
                <button onClick={() => setShowComparison(!showComparison)} className="w-full flex items-center justify-between p-4 text-left">
                  <span className="text-[12px] font-bold text-white/60">🔬 Porównanie składników</span>
                  <span className="text-white/30 text-[12px]">{showComparison ? "▲" : "▼"}</span>
                </button>
                {showComparison && (
                  <div className="px-4 pb-4 space-y-1.5">
                    {comparison.map((c: { ingredient: string; yours: string; alternative: string }, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] py-1.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                        <span className="text-white/55 flex-1">{c.ingredient}</span>
                        <span className="text-red-400/70 flex-1 text-right">{c.yours}</span>
                        <span className="text-white/20">→</span>
                        <span className="text-emerald-400/70 flex-1">{c.alternative}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tip */}
            {tip && (cheaper || better) && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-[16px] bg-white/[0.02] border border-white/[0.06]">
                <span className="text-base mt-0.5">💡</span>
                <p className="text-[12px] text-white/55 leading-relaxed">{tip}</p>
              </div>
            )}
          </div>
          );
        })()}

        {/* ══ TAB: OCENA (cosmetics) ══ */}
        {active === "review" && isCosmetics && cosResult && (
          <div className="space-y-3">
            {/* Alarm warnings (pregnancy / strong allergens) */}
            {cosResult.warnings && cosResult.warnings.length > 0 && (() => {
              const alarms = cosResult.warnings.map(normalizeWarning).filter(w => w.level === "alarm");
              if (alarms.length === 0) return null;
              return (
                <div className="rounded-[20px] p-4 bg-red-500/10 border border-red-500/30">
                  {alarms.map((w, i) => (
                    <p key={i} className="text-[13px] font-semibold text-red-400 leading-relaxed">{w.text}</p>
                  ))}
                </div>
              );
            })()}

            {/* Dobre dla */}
            {cosResult.good_for && cosResult.good_for.length > 0 && (
              <div className="velvet-card rounded-[20px] p-5">
                <h3 className="font-bold text-emerald-400 mb-3 text-[13px]">✅ Dobre dla:</h3>
                <div className="flex flex-wrap gap-2">
                  {cosResult.good_for.map((g, i) => (
                    <span key={i} className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400">{g}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Unikaj przy */}
            {cosResult.bad_for && cosResult.bad_for.length > 0 && (
              <div className="velvet-card rounded-[20px] p-5">
                <h3 className="font-bold text-red-400 mb-3 text-[13px]">❌ Unikaj przy:</h3>
                <div className="flex flex-wrap gap-2">
                  {cosResult.bad_for.map((b, i) => (
                    <span key={i} className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-red-500/10 text-red-400">{b}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Caution warnings */}
            {cosResult.warnings && cosResult.warnings.length > 0 && (() => {
              const cautions = cosResult.warnings.map(normalizeWarning).filter(w => w.level !== "alarm");
              if (cautions.length === 0) return null;
              return (
                <div className="velvet-card rounded-[20px] p-5">
                  <h3 className="font-bold text-amber-400 mb-3 text-[13px]">⚠️ Ostrzeżenia:</h3>
                  <ul className="space-y-2">
                    {cautions.map((w, i) => (
                      <li key={i} className="text-[12px] text-white/55 leading-relaxed">
                        {w.pregnancy_risk && <span className="text-pink-400 font-bold mr-1">🤰</span>}
                        {w.text}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* Kompatybilność */}
            {cosResult.compatibility && (
              <div className="velvet-card rounded-[20px] p-5">
                <h3 className="font-bold text-purple-400 mb-3 text-[13px]">🧴 Kompatybilność</h3>
                <div className="space-y-3">
                  {cosResult.compatibility.best_time && (
                    <div className="flex items-center gap-2">
                      <span className="text-[13px]">⏰</span>
                      <span className="text-[12px] text-white/55">Najlepiej stosować:</span>
                      <span className="text-[12px] font-bold text-white/70">
                        {cosResult.compatibility.best_time === "wieczór" ? "🌙 wieczorem"
                          : cosResult.compatibility.best_time === "rano" ? "☀️ rano"
                          : "☀️🌙 rano i wieczorem"}
                      </span>
                    </div>
                  )}
                  {cosResult.compatibility.works_well_with && cosResult.compatibility.works_well_with.length > 0 && (
                    <div>
                      <p className="text-[10px] text-emerald-400/60 font-bold uppercase tracking-wider mb-1.5">Łączyć z:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cosResult.compatibility.works_well_with.map((s, i) => (
                          <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">✅ {s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {cosResult.compatibility.avoid_with && cosResult.compatibility.avoid_with.length > 0 && (
                    <div>
                      <p className="text-[10px] text-red-400/60 font-bold uppercase tracking-wider mb-1.5">Nie łączyć z:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cosResult.compatibility.avoid_with.map((s, i) => (
                          <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 font-semibold">⚠️ {s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pros / cons / tip */}
            {cosResult.pros && cosResult.pros.length > 0 && (
              <div className="velvet-card rounded-[20px] p-5 border-l-4 border-l-emerald-500">
                <h3 className="font-bold mb-3 text-[13px] text-emerald-400">✓ Plusy</h3>
                <ul className="space-y-2.5">
                  {cosResult.pros.map((pro, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] text-white/60">
                      <span className="text-emerald-400 font-bold flex-shrink-0">+</span><span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cosResult.cons && cosResult.cons.length > 0 && (
              <div className="velvet-card rounded-[20px] p-5 border-l-4 border-l-red-500">
                <h3 className="font-bold mb-3 text-[13px] text-red-400">✗ Minusy</h3>
                <ul className="space-y-2.5">
                  {cosResult.cons.map((con, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] text-white/60">
                      <span className="text-red-400 font-bold flex-shrink-0">−</span><span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cosResult.tip && (
              <div className="velvet-card rounded-[20px] p-5 border-l-4 border-l-purple-500">
                <h3 className="font-bold mb-2 text-[13px] text-purple-400">💡 Rada eksperta</h3>
                <p className="text-[13px] leading-relaxed text-white/60">{cosResult.tip}</p>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: SKŁAD (suplement) ══ */}
        {active === "ingredients" && isSuplement && suppResult && (
          <div className="space-y-2.5">
            {suppResult.ingredients?.map((ing, i) => {
              const catColors: Record<string, string> = {
                essential: "#22c55e", beneficial: "#86efac", neutral: "#94a3b8", unnecessary: "#f59e0b", risky: "#ef4444",
              };
              const catLabels: Record<string, string> = {
                essential: "Kluczowy", beneficial: "Pomocny", neutral: "Neutralny", unnecessary: "Zbędny", risky: "Ryzyko",
              };
              const color = catColors[ing.category] || "#94a3b8";
              return (
                <div key={i} className="velvet-card rounded-[18px] p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-[13px] font-bold text-white/90 flex-1">{ing.name}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {ing.dose && <span className="text-[11px] font-bold text-blue-300">{ing.dose}</span>}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>{catLabels[ing.category]}</span>
                    </div>
                  </div>
                  {ing.daily_value_percent != null && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(ing.daily_value_percent, 100)}%`, background: ing.daily_value_percent > 300 ? "#ef4444" : ing.daily_value_percent > 100 ? "#f59e0b" : "#22c55e" }} />
                      </div>
                      <span className="text-[10px] font-bold text-white/55">{ing.daily_value_percent}% NRV</span>
                    </div>
                  )}
                  <p className="text-[12px] text-white/55 leading-relaxed">{ing.explanation}</p>
                </div>
              );
            })}
            {suppResult.fun_comparisons && suppResult.fun_comparisons.length > 0 && (
              <div className="velvet-card rounded-[20px] p-5">
                <p className="text-[11px] font-bold text-blue-400/70 uppercase tracking-widest mb-3">💡 Warto wiedzieć</p>
                <ul className="space-y-2">
                  {suppResult.fun_comparisons.map((c, i) => (
                    <li key={i} className="text-[12px] text-white/55 leading-relaxed">{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: ALTERNATYWY (suplement) ══ */}
        {active === "alternatives" && isSuplement && suppResult && (() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const alt = (suppResult as any).alternatives;
          const cheaper = alt?.cheaper || null;
          const better = alt?.better || null;
          const comparison = alt?.comparison || [];
          const altVerdict = alt?.verdict || "";
          const tip = alt?.tip || suppResult.tip || "";
          return (
          <div className="space-y-3">
            {/* Mini hook */}
            {(cheaper || better) && (
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, textAlign: "center", margin: "0 0 14px" }}>
                💸 AI znalazł lepsze opcje z tym samym składem
              </p>
            )}

            {/* Best choice card — when no alternatives needed */}
            {!cheaper && !better && (
              <div className="rounded-[20px] p-5" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🏆</span>
                  <h3 className="text-[18px] font-black" style={{ color: "#22c55e" }}>Najlepszy wybór!</h3>
                </div>
                <p className="text-[12px] text-white/55 leading-relaxed mt-2">{altVerdict || "Świetny wybór! Ten suplement ma dobry skład w odpowiednich dawkach. Nie znaleźliśmy lepszej opcji."}</p>
                {tip && (
                  <div className="flex items-start gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-sm">💡</span>
                    <p className="text-[11px] text-white/55 leading-relaxed">{tip}</p>
                  </div>
                )}
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[11px] font-bold text-white/55 uppercase tracking-widest mb-2">🛒 Gdzie kupić najtaniej</p>
                  <ShoppingLinks name={suppResult.name || ""} category="supplement" />
                </div>
              </div>
            )}

            {/* Karta Tańsza opcja */}
            {cheaper && (
              <div onClick={() => setSelectedAlt(selectedAlt === "cheaper" ? null : "cheaper")} className={`rounded-[20px] p-5 transition-all cursor-pointer ${selectedAlt === "cheaper" ? "ring-2 ring-emerald-400/50" : ""}`} style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">🟢 Tańsza opcja</span>
                  {selectedAlt === "cheaper" && <span className="text-emerald-400">✅</span>}
                </div>
                <div className="flex items-center gap-3">
                  {cheaper.score && (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0" style={{ background: cheaper.score >= 7 ? "#22c55e" : cheaper.score >= 4 ? "#f59e0b" : "#ef4444" }}>
                      {cheaper.score}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-white/90">{cheaper.name}</p>
                    <p className="text-[11px] text-white/55 mt-0.5">{cheaper.reason}</p>
                  </div>
                </div>
                <ShoppingLinks name={cheaper.search_query || cheaper.name} category="supplement" />
              </div>
            )}

            {/* Karta Lepszy skład */}
            {better && (
              <div onClick={() => setSelectedAlt(selectedAlt === "better" ? null : "better")} className={`rounded-[20px] p-5 transition-all cursor-pointer ${selectedAlt === "better" ? "ring-2 ring-blue-400/50" : ""}`} style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-blue-400 uppercase tracking-widest">⭐ Lepszy skład</span>
                  <div className="flex items-center gap-1.5">
                    {better.score && <span className="text-[12px] font-bold text-blue-400">{better.score}/10</span>}
                    {selectedAlt === "better" && <span className="text-blue-400">✅</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {better.score && (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0" style={{ background: better.score >= 7 ? "#22c55e" : better.score >= 4 ? "#f59e0b" : "#ef4444" }}>
                      {better.score}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-white/90">{better.name}</p>
                    <p className="text-[11px] text-white/55 mt-0.5">{better.reason}</p>
                  </div>
                </div>
                {better.advantages && better.advantages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    {better.advantages.map((a: string, i: number) => (
                      <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-500/10 text-blue-300">{a}</span>
                    ))}
                  </div>
                )}
                <ShoppingLinks name={better.search_query || better.name} category="supplement" />
              </div>
            )}

            {/* Porównanie składników (akordeon) */}
            {comparison.length > 0 && (
              <div className="velvet-card rounded-[20px] overflow-hidden">
                <button onClick={() => setShowComparison(!showComparison)} className="w-full flex items-center justify-between p-4 text-left">
                  <span className="text-[12px] font-bold text-white/60">🔬 Porównanie składników</span>
                  <span className="text-white/30 text-[12px]">{showComparison ? "▲" : "▼"}</span>
                </button>
                {showComparison && (
                  <div className="px-4 pb-4 space-y-1.5">
                    {comparison.map((c: { ingredient: string; yours: string; alternative: string }, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] py-1.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                        <span className="text-white/55 flex-1">{c.ingredient}</span>
                        <span className="text-red-400/70 flex-1 text-right">{c.yours}</span>
                        <span className="text-white/20">→</span>
                        <span className="text-emerald-400/70 flex-1">{c.alternative}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tip */}
            {tip && (cheaper || better) && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-[16px] bg-white/[0.02] border border-white/[0.06]">
                <span className="text-base mt-0.5">💡</span>
                <p className="text-[12px] text-white/55 leading-relaxed">{tip}</p>
              </div>
            )}
          </div>
          );
        })()}

        {/* ══ TAB: OCENA (suplement) ══ */}
        {active === "review" && isSuplement && suppResult && (
          <div className="space-y-3">
            {suppResult.dose_warning && (
              <div className="rounded-[20px] p-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span>⚠️</span>
                  <span className="text-[13px] font-bold text-red-400">Ostrzeżenie o dawce</span>
                </div>
                <p className="text-[12px] text-red-300/80">{suppResult.dose_warning}</p>
              </div>
            )}
            {suppResult.who_for && suppResult.who_for.length > 0 && (
              <div className="velvet-card rounded-[20px] p-5 border-l-4 border-l-emerald-400">
                <h3 className="font-bold mb-3 text-[13px] text-emerald-400">✓ Dobre dla</h3>
                <ul className="space-y-2">
                  {suppResult.who_for.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-white/60">
                      <span className="text-emerald-400 font-bold shrink-0">•</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {suppResult.who_avoid && suppResult.who_avoid.length > 0 && (
              <div className="velvet-card rounded-[20px] p-5 border-l-4 border-l-red-400">
                <h3 className="font-bold mb-3 text-[13px] text-red-400">✗ Unikaj przy</h3>
                <ul className="space-y-2">
                  {suppResult.who_avoid.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-white/60">
                      <span className="text-red-400 font-bold shrink-0">•</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {suppResult.interactions && suppResult.interactions.length > 0 && (
              <div className="velvet-card rounded-[20px] p-5 border-l-4 border-l-amber-400">
                <h3 className="font-bold mb-3 text-[13px] text-amber-400">⚠️ Interakcje</h3>
                <ul className="space-y-2">
                  {suppResult.interactions.map((item, i) => (
                    <li key={i} className="text-[12px] text-white/60 flex gap-2"><span className="text-amber-400 shrink-0">•</span>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {suppResult.pros && suppResult.pros.length > 0 && (
              <div className="velvet-card rounded-[20px] p-5">
                <h3 className="font-bold mb-3 text-[13px] text-blue-400">👍 Plusy</h3>
                <ul className="space-y-1.5">
                  {suppResult.pros.map((p, i) => <li key={i} className="text-[12px] text-white/60 flex gap-2"><span className="text-blue-400 shrink-0">+</span>{p}</li>)}
                </ul>
              </div>
            )}
            {suppResult.cons && suppResult.cons.length > 0 && (
              <div className="velvet-card rounded-[20px] p-5">
                <h3 className="font-bold mb-3 text-[13px] text-amber-400">👎 Minusy</h3>
                <ul className="space-y-1.5">
                  {suppResult.cons.map((c, i) => <li key={i} className="text-[12px] text-white/60 flex gap-2"><span className="text-amber-400 shrink-0">−</span>{c}</li>)}
                </ul>
              </div>
            )}
            <p className="text-[10px] text-center text-white/20 mt-2">
              ⚠️ Informacje orientacyjne. Zawsze konsultuj się z lekarzem lub farmaceutą.
            </p>
          </div>
        )}

        {/* ══ TAB: OCENA (food) ══ */}
        {active === "review" && !isCosmetics && !isSuplement && (
          <div className="space-y-3">
            {result.pros && result.pros.length > 0 && (
              <div className="card-elevated rounded-[20px] p-5 border-l-4 border-l-emerald-400">
                <h3 className="font-bold mb-3 text-[13px] text-emerald-700">✓ Plusy</h3>
                <ul className="space-y-2.5">
                  {result.pros.map((pro, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] text-gray-600">
                      <span className="text-emerald-400 font-bold flex-shrink-0">+</span><span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.cons && result.cons.length > 0 && (
              <div className="card-elevated rounded-[20px] p-5 border-l-4 border-l-red-400">
                <h3 className="font-bold mb-3 text-[13px] text-red-600">✗ Minusy</h3>
                <ul className="space-y-2.5">
                  {result.cons.map((con, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] text-gray-600">
                      <span className="text-red-400 font-bold flex-shrink-0">−</span><span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.tip && (
              <div className="card-elevated rounded-[20px] p-5 border-l-4 border-l-blue-400">
                <h3 className="font-bold mb-2 text-[13px] text-blue-600">💡 Rada eksperta</h3>
                <p className="text-[13px] leading-relaxed text-gray-600">{result.tip}</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
