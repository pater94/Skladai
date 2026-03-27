"use client";

import { useState } from "react";

interface InciResult {
  name: string;
  polish_name: string;
  safety: string;
  safety_label: string;
  what_it_does: string;
  good_for: string[];
  bad_for: string[];
  optimal_concentration: string | null;
  combine_with: string[];
  avoid_with: string[];
  fun_fact: string;
  products_with: { name: string; price_range: string }[];
  verdict: string;
}

export default function InciSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<InciResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: query.trim(), mode: "inci_search" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Nie znaleziono."); return; }
      setResult(data);
    } catch {
      setError("Brak połączenia.");
    } finally {
      setLoading(false);
    }
  };

  const safetyColor = (s: string) => {
    switch (s) {
      case "safe": return { bg: "bg-emerald-500/15", text: "text-emerald-400", icon: "✅" };
      case "caution": return { bg: "bg-amber-500/15", text: "text-amber-400", icon: "⚠️" };
      case "controversial": return { bg: "bg-orange-500/15", text: "text-orange-400", icon: "⚠️" };
      case "harmful": return { bg: "bg-red-500/15", text: "text-red-400", icon: "🔴" };
      default: return { bg: "bg-gray-500/15", text: "text-gray-400", icon: "❓" };
    }
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="velvet-card rounded-[18px] p-4 border border-white/[0.06]">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="🔍 Szukaj składnika... np. Retinol, SLS"
            className="flex-1 bg-white/5 border border-white/10 rounded-[12px] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-fuchsia-500/50"
          />
          <button
            onClick={search}
            disabled={loading}
            className="px-4 py-2.5 bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white rounded-[12px] text-[12px] font-bold active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? "..." : "Szukaj"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-[12px] text-center">{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-6">
          <div className="w-4 h-4 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-white/40 text-[12px]">Szukam składnika...</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="velvet-card rounded-[20px] p-5 border border-white/[0.06] space-y-4">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[16px] font-bold text-white">{result.name}</h3>
              {(() => {
                const sc = safetyColor(result.safety);
                return (
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                    {sc.icon} {result.safety_label}
                  </span>
                );
              })()}
            </div>
            {result.polish_name && result.polish_name !== result.name && (
              <p className="text-[12px] text-white/40">{result.polish_name}</p>
            )}
          </div>

          {/* What it does */}
          <p className="text-[13px] text-white/60 leading-relaxed">{result.what_it_does}</p>

          {/* Good for / Bad for */}
          <div className="grid grid-cols-2 gap-2">
            {result.good_for?.length > 0 && (
              <div className="bg-emerald-500/5 rounded-[12px] p-3">
                <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider mb-1.5">Dobre dla</p>
                {result.good_for.map((g, i) => (
                  <p key={i} className="text-[11px] text-white/50">✅ {g}</p>
                ))}
              </div>
            )}
            {result.bad_for?.length > 0 && (
              <div className="bg-red-500/5 rounded-[12px] p-3">
                <p className="text-[9px] text-red-400 font-bold uppercase tracking-wider mb-1.5">Złe dla</p>
                {result.bad_for.map((b, i) => (
                  <p key={i} className="text-[11px] text-white/50">⚠️ {b}</p>
                ))}
              </div>
            )}
          </div>

          {/* Concentration */}
          {result.optimal_concentration && (
            <p className="text-[11px] text-white/40">
              💉 Optymalne stężenie: <span className="text-white/70 font-semibold">{result.optimal_concentration}</span>
            </p>
          )}

          {/* Combine / Avoid */}
          {(result.combine_with?.length > 0 || result.avoid_with?.length > 0) && (
            <div className="space-y-2">
              {result.combine_with?.length > 0 && (
                <div>
                  <p className="text-[9px] text-emerald-400/60 font-bold uppercase tracking-wider mb-1">Łączyć z:</p>
                  <div className="flex flex-wrap gap-1">
                    {result.combine_with.map((s, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">✅ {s}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.avoid_with?.length > 0 && (
                <div>
                  <p className="text-[9px] text-red-400/60 font-bold uppercase tracking-wider mb-1">Nie łączyć z:</p>
                  <div className="flex flex-wrap gap-1">
                    {result.avoid_with.map((s, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold">⚠️ {s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fun fact */}
          {result.fun_fact && (
            <div className="bg-fuchsia-500/5 rounded-[12px] p-3">
              <p className="text-[9px] text-fuchsia-400 font-bold uppercase tracking-wider mb-1">💡 Ciekawostka</p>
              <p className="text-[11px] text-white/50">{result.fun_fact}</p>
            </div>
          )}

          {/* Products */}
          {result.products_with?.length > 0 && (
            <div>
              <p className="text-[9px] text-amber-400/60 font-bold uppercase tracking-wider mb-1.5">💰 Produkty z tym składnikiem</p>
              {result.products_with.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-[11px] text-white/50">{p.name}</span>
                  <span className="text-[11px] font-bold text-amber-400">{p.price_range}</span>
                </div>
              ))}
            </div>
          )}

          {/* Verdict */}
          <p className="text-[12px] text-white/50 italic">{result.verdict}</p>

          {/* Close */}
          <button
            onClick={() => { setResult(null); setQuery(""); }}
            className="w-full py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-[12px] text-white/40 text-[12px] font-semibold active:scale-[0.97] transition-transform"
          >
            Zamknij
          </button>
        </div>
      )}
    </div>
  );
}
