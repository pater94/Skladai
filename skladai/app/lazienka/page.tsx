"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { getHistory } from "@/lib/storage";
import type { ScanHistoryItem } from "@/lib/types";
import { getScoreColor } from "@/components/ScoreRing";

type SortMode = "score" | "date" | "name";
type CategoryKey = "morning" | "evening" | "shower" | "makeup" | "other";

const CATEGORIES: { key: CategoryKey; label: string; emoji: string }[] = [
  { key: "morning", label: "Rutyna poranna", emoji: "☀️" },
  { key: "evening", label: "Rutyna wieczorna", emoji: "🌙" },
  { key: "shower", label: "Prysznic", emoji: "🚿" },
  { key: "makeup", label: "Makijaz", emoji: "💄" },
  { key: "other", label: "Inne", emoji: "🧴" },
];

const CATEGORY_KEYWORDS: Record<CategoryKey, string[]> = {
  morning: ["spf", "krem na dzien", "tonik", "serum witamina c", "krem nawilzajacy", "krem bb", "krem cc"],
  evening: ["krem na noc", "retinol", "serum na noc", "olejek", "maska", "peeling"],
  shower: ["szampon", "zel pod prysznic", "odzywka", "mydlo", "peeling ciala", "balsam"],
  makeup: ["podklad", "puder", "tusz", "pomadka", "cien", "bronzer", "roz", "korektor", "mascara", "eyeliner"],
  other: [],
};

function categorizeProduct(item: ScanHistoryItem): CategoryKey {
  const name = (item.name + " " + (item.result && "category" in item.result ? item.result.category : "")).toLowerCase();
  for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS) as [CategoryKey, string[]][]) {
    if (key === "other") continue;
    if (keywords.some((kw) => name.includes(kw))) return key;
  }
  return "other";
}

export default function LazienkaPage() {
  const [products, setProducts] = useState<ScanHistoryItem[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [collapsed, setCollapsed] = useState<Record<CategoryKey, boolean>>({
    morning: false, evening: false, shower: false, makeup: false, other: false,
  });
  const [assignOverrides, setAssignOverrides] = useState<Record<string, CategoryKey>>({});

  useEffect(() => {
    const history = getHistory().filter((h) => h.scanType === "cosmetics");
    setProducts(history);
    // Load category overrides
    try {
      const saved = localStorage.getItem("skladai_lazienka_categories");
      if (saved) setAssignOverrides(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const sorted = useMemo(() => {
    const copy = [...products];
    switch (sortMode) {
      case "score": copy.sort((a, b) => a.score - b.score); break;
      case "name": copy.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "date": default: copy.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); break;
    }
    return copy;
  }, [products, sortMode]);

  const categorized = useMemo(() => {
    const result: Record<CategoryKey, ScanHistoryItem[]> = {
      morning: [], evening: [], shower: [], makeup: [], other: [],
    };
    for (const item of sorted) {
      const cat = assignOverrides[item.id] || categorizeProduct(item);
      result[cat].push(item);
    }
    return result;
  }, [sorted, assignOverrides]);

  const stats = useMemo(() => {
    if (products.length === 0) return { avg: 0, total: 0, safe: 0, risky: 0 };
    const avg = Math.round(products.reduce((s, p) => s + p.score, 0) / products.length * 10) / 10;
    const safe = products.filter((p) => p.score >= 7).length;
    const risky = products.filter((p) => p.score < 4).length;
    return { avg, total: products.length, safe, risky };
  }, [products]);

  const worstProducts = useMemo(() => {
    return [...products].sort((a, b) => a.score - b.score).slice(0, 3).filter((p) => p.score < 5);
  }, [products]);

  const toggleCollapse = (key: CategoryKey) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  };

  return (
    <div className="min-h-[100dvh] bg-[#0D0B0E]">
      <div className="max-w-md mx-auto px-5 pt-3">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold opacity-70 hover:opacity-100 transition-opacity" style={{color: 'inherit'}}>
          <span>←</span> Wstecz
        </Link>
      </div>
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-purple-500/8 blur-[100px]" />
        <div className="absolute top-20 right-0 w-[200px] h-[200px] rounded-full bg-fuchsia-500/10 blur-[80px]" />

        <div className="max-w-md mx-auto px-5 pt-14 pb-8 relative z-10">
          <div className="text-center">
            <Link href="/" className="inline-block">
              <h1 className="text-[32px] font-black tracking-[-1.5px] mb-1">
                <span className="text-white">Sklad</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-purple-400">AI</span>
              </h1>
            </Link>
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-[1px] w-8 bg-purple-400/40" />
              <span className="text-[9px] tracking-[2px] uppercase text-white/40 font-semibold">{"🚿"} MOJA LAZIENKA</span>
              <div className="h-[1px] w-8 bg-purple-400/40" />
            </div>
            <p className="text-white/40 text-[13px] font-medium">Wszystkie Twoje kosmetyki w jednym miejscu</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-5 pb-28 relative z-20">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[
            { value: stats.avg, label: "Srednia", color: "text-white" },
            { value: stats.total, label: "Produkty", color: "text-white" },
            { value: stats.safe, label: "Bezpieczne", color: "text-emerald-400" },
            { value: stats.risky, label: "Ryzykowne", color: "text-red-400" },
          ].map((s, i) => (
            <div key={i} className="text-center py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <p className={`text-[16px] font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[8px] tracking-[1px] uppercase font-semibold text-white/30">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-2 mb-5">
          {([
            { id: "date" as SortMode, label: "Najnowsze" },
            { id: "score" as SortMode, label: "Wg oceny" },
            { id: "name" as SortMode, label: "Wg nazwy" },
          ]).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSortMode(opt.id)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${
                sortMode === opt.id
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "bg-white/[0.03] text-white/30 border border-white/[0.06]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {products.length === 0 && (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">{"🧴"}</span>
            <p className="text-white/40 text-sm font-semibold mb-2">Twoja łazienka jest pusta</p>
            <p className="text-white/20 text-xs mb-6">Zeskanuj kosmetyki na stronie głównej w trybie Kosmetyk</p>
            <Link
              href="/"
              className="inline-block px-6 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-violet-600 text-white text-sm font-bold shadow-lg shadow-purple-500/25"
            >
              Skanuj kosmetyk
            </Link>
          </div>
        )}

        {/* Categories */}
        {products.length > 0 && CATEGORIES.map(({ key, label, emoji }) => {
          const items = categorized[key];
          if (items.length === 0) return null;
          const isCollapsed = collapsed[key];

          return (
            <div key={key} className="mb-4">
              <button
                onClick={() => toggleCollapse(key)}
                className="w-full flex items-center gap-2 py-2.5 px-1"
              >
                <span className="text-base">{emoji}</span>
                <h3 className="text-white text-sm font-bold flex-1 text-left">{label}</h3>
                <span className="text-white/20 text-xs font-medium mr-1">{items.length}</span>
                <span className={`text-white/20 text-xs transition-transform ${isCollapsed ? "" : "rotate-180"}`}>
                  {"▼"}
                </span>
              </button>

              {!isCollapsed && (
                <div className="space-y-2">
                  {items.map((item) => {
                    const scoreInfo = getScoreColor(item.score);
                    return (
                      <Link
                        key={item.id}
                        href={`/wyniki/${item.id}`}
                        className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 hover:bg-white/[0.05] transition-colors"
                      >
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-lg shrink-0">
                            {"🧴"}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white/90 text-sm font-semibold truncate">{item.name}</p>
                          <p className="text-white/30 text-[10px] font-medium">
                            {item.brand}{item.brand ? " · " : ""}{formatDate(item.date)}
                          </p>
                        </div>
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                          style={{ backgroundColor: scoreInfo.bg, color: scoreInfo.color }}
                        >
                          {item.score}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Worst products */}
        {worstProducts.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">{"🔴"}</span>
              <h3 className="text-white text-sm font-bold">Najgorsze w łazience</h3>
            </div>
            <div className="space-y-2">
              {worstProducts.map((item) => {
                const scoreInfo = getScoreColor(item.score);
                return (
                  <div
                    key={item.id}
                    className="bg-red-500/[0.06] border border-red-500/15 rounded-2xl p-3.5"
                  >
                    <div className="flex items-center gap-3">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-lg shrink-0">
                          {"⚠️"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white/90 text-sm font-semibold truncate">{item.name}</p>
                        <p className="text-white/30 text-[10px] font-medium">{item.brand}</p>
                      </div>
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ backgroundColor: scoreInfo.bg, color: scoreInfo.color }}
                      >
                        {item.score}
                      </div>
                    </div>
                    <p className="text-red-400/60 text-[11px] font-medium mt-2 pl-[52px]">
                      Rozważ zamianę na produkt z wyższą oceną. Sprawdź alternatywy w skanerze.
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Back link */}
        <Link
          href="/"
          className="block text-center mt-6 text-white/30 text-xs font-semibold hover:text-white/50 transition-colors"
        >
          Powrot do skanera
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}
