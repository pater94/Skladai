"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { getHistory } from "@/lib/storage";
import type { ScanHistoryItem } from "@/lib/types";
import { getScoreColor } from "@/components/ScoreRing";

interface RoutineProduct {
  slot: string;
  name: string;
  score: number;
  brand: string;
}

interface RoutineData {
  morning: RoutineProduct[];
  evening: RoutineProduct[];
}

const MORNING_SLOTS = ["Oczyszczanie", "Tonik", "Serum", "Krem", "SPF"];
const EVENING_SLOTS = ["Demakijaz", "Oczyszczanie", "Serum/Aktyw", "Krem na noc"];

const SLOT_EMOJIS: Record<string, string> = {
  "Oczyszczanie": "🧼",
  "Tonik": "💧",
  "Serum": "💜",
  "Krem": "🤍",
  "SPF": "☀️",
  "Demakijaz": "🌸",
  "Serum/Aktyw": "⚗️",
  "Krem na noc": "🌙",
};

const ROUTINE_KEY = "skladai_routine";

function getRoutine(): RoutineData {
  if (typeof window === "undefined") return { morning: [], evening: [] };
  try {
    const data = localStorage.getItem(ROUTINE_KEY);
    if (!data) return { morning: [], evening: [] };
    return JSON.parse(data) as RoutineData;
  } catch {
    return { morning: [], evening: [] };
  }
}

function saveRoutine(data: RoutineData): void {
  localStorage.setItem(ROUTINE_KEY, JSON.stringify(data));
}

export default function RutynaPage() {
  const [routine, setRoutine] = useState<RoutineData>({ morning: [], evening: [] });
  const [addingSlot, setAddingSlot] = useState<{ period: "morning" | "evening"; slot: string } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [cosmeticHistory, setCosmeticHistory] = useState<ScanHistoryItem[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  useEffect(() => {
    setRoutine(getRoutine());
    const history = getHistory().filter((h) => h.scanType === "cosmetics");
    setCosmeticHistory(history);
  }, []);

  const getProductForSlot = (period: "morning" | "evening", slot: string): RoutineProduct | undefined => {
    return routine[period].find((p) => p.slot === slot);
  };

  const addProduct = (period: "morning" | "evening", slot: string, name: string, score: number = 5, brand: string = "") => {
    const updated = { ...routine };
    updated[period] = updated[period].filter((p) => p.slot !== slot);
    updated[period].push({ slot, name, score, brand });
    setRoutine(updated);
    saveRoutine(updated);
    setAddingSlot(null);
    setInputValue("");
    setShowHistory(false);
  };

  const removeProduct = (period: "morning" | "evening", slot: string) => {
    const updated = { ...routine };
    updated[period] = updated[period].filter((p) => p.slot !== slot);
    setRoutine(updated);
    saveRoutine(updated);
  };

  const handleAiAnalyze = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "routine_analyze",
          text: JSON.stringify(routine),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiResult(data.verdict || data.tip || "Rutyna wygląda dobrze! Pamiętaj o regularności.");
      } else {
        setAiResult("Funkcja analizy rutyny będzie dostępna wkrótce. Tymczasem pamiętaj: kolejność ma znaczenie!");
      }
    } catch {
      setAiResult("Funkcja analizy rutyny będzie dostępna wkrótce. Tymczasem pamiętaj: kolejność ma znaczenie!");
    } finally {
      setAiLoading(false);
    }
  };

  const totalProducts = routine.morning.length + routine.evening.length;
  const avgScore = totalProducts > 0
    ? Math.round(([...routine.morning, ...routine.evening].reduce((s, p) => s + p.score, 0) / totalProducts) * 10) / 10
    : 0;

  const renderSlots = (period: "morning" | "evening", slots: string[]) => (
    <div className="space-y-2">
      {slots.map((slot, index) => {
        const product = getProductForSlot(period, slot);
        const isAdding = addingSlot?.period === period && addingSlot?.slot === slot;
        const emoji = SLOT_EMOJIS[slot] || "🧴";
        const scoreInfo = product ? getScoreColor(product.score) : null;

        return (
          <div key={slot}>
            {product ? (
              <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 group">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-sm font-bold text-purple-400 shrink-0">
                  {index + 1}
                </div>
                <span className="text-lg">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 text-sm font-semibold truncate">{product.name}</p>
                  <p className="text-white/30 text-[10px] font-medium tracking-wider uppercase">{slot}{product.brand ? ` · ${product.brand}` : ""}</p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: scoreInfo?.bg, color: scoreInfo?.color }}
                >
                  {product.score}
                </div>
                <button
                  onClick={() => removeProduct(period, slot)}
                  className="text-white/20 hover:text-red-400 text-lg transition-colors ml-1"
                >
                  x
                </button>
              </div>
            ) : (
              <div>
                {isAdding ? (
                  <div className="bg-white/[0.04] border border-purple-500/30 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{emoji}</span>
                      <span className="text-white/50 text-xs font-semibold">{slot}</span>
                    </div>
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Nazwa produktu..."
                      className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-purple-500/50"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && inputValue.trim()) {
                          addProduct(period, slot, inputValue.trim());
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (inputValue.trim()) addProduct(period, slot, inputValue.trim());
                        }}
                        className="flex-1 py-2 rounded-xl bg-purple-500/20 text-purple-300 text-xs font-bold"
                      >
                        Dodaj
                      </button>
                      <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="flex-1 py-2 rounded-xl bg-white/[0.04] text-white/40 text-xs font-bold"
                      >
                        Z ostatnich skanow
                      </button>
                      <button
                        onClick={() => { setAddingSlot(null); setInputValue(""); setShowHistory(false); }}
                        className="px-3 py-2 rounded-xl bg-white/[0.04] text-white/30 text-xs font-bold"
                      >
                        Anuluj
                      </button>
                    </div>
                    {showHistory && cosmeticHistory.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {cosmeticHistory.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => addProduct(period, slot, item.name, item.score, item.brand)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
                          >
                            <span className="text-white/80 text-xs font-semibold truncate flex-1">{item.name}</span>
                            <span className="text-white/30 text-[10px]">{item.brand}</span>
                            <span
                              className="text-xs font-bold px-1.5 py-0.5 rounded-lg"
                              style={{ color: getScoreColor(item.score).color, backgroundColor: getScoreColor(item.score).bg }}
                            >
                              {item.score}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showHistory && cosmeticHistory.length === 0 && (
                      <p className="text-white/20 text-xs text-center py-3">Brak zeskanowanych kosmetyków. Zeskanuj produkt na stronie głównej.</p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingSlot({ period, slot }); setInputValue(""); setShowHistory(false); }}
                    className="w-full flex items-center gap-3 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-3.5 hover:border-purple-500/30 hover:bg-white/[0.04] transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center text-sm font-bold text-white/15 shrink-0">
                      {index + 1}
                    </div>
                    <span className="text-lg opacity-30">{emoji}</span>
                    <div className="flex-1 text-left">
                      <p className="text-white/20 text-xs font-semibold">{slot}</p>
                      <p className="text-purple-400/40 text-[10px] font-medium">+ Dodaj produkt</p>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

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
              <span className="text-[9px] tracking-[2px] uppercase text-white/40 font-semibold">MOJA RUTYNA</span>
              <div className="h-[1px] w-8 bg-purple-400/40" />
            </div>
            <p className="text-white/40 text-[13px] font-medium">Zbuduj swoja rutyne pielegnacyjna krok po kroku</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-5 pb-28 relative z-20">
        {/* Stats */}
        {totalProducts > 0 && (
          <div className="flex gap-3 mb-6">
            <div className="flex-1 text-center py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[18px] font-bold text-white">{totalProducts}</p>
              <p className="text-[9px] tracking-[1px] uppercase font-semibold text-white/30">produktow</p>
            </div>
            <div className="flex-1 text-center py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[18px] font-bold text-white">{avgScore}</p>
              <p className="text-[9px] tracking-[1px] uppercase font-semibold text-white/30">srednia</p>
            </div>
            <div className="flex-1 text-center py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[18px] font-bold text-fuchsia-400">{MORNING_SLOTS.length + EVENING_SLOTS.length - totalProducts}</p>
              <p className="text-[9px] tracking-[1px] uppercase font-semibold text-white/30">brakuje</p>
            </div>
          </div>
        )}

        {/* Morning Routine */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">&#9728;&#65039;</span>
            <h2 className="text-white text-lg font-bold">Poranna</h2>
            <span className="text-white/20 text-xs font-medium ml-auto">{routine.morning.length}/{MORNING_SLOTS.length}</span>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-[20px] p-3">
            {renderSlots("morning", MORNING_SLOTS)}
          </div>
        </div>

        {/* Evening Routine */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">&#127769;</span>
            <h2 className="text-white text-lg font-bold">Wieczorna</h2>
            <span className="text-white/20 text-xs font-medium ml-auto">{routine.evening.length}/{EVENING_SLOTS.length}</span>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-[20px] p-3">
            {renderSlots("evening", EVENING_SLOTS)}
          </div>
        </div>

        {/* AI Analyze Button */}
        <button
          onClick={handleAiAnalyze}
          disabled={aiLoading || totalProducts === 0}
          className={`w-full py-4 rounded-2xl text-sm font-bold transition-all ${
            totalProducts === 0
              ? "bg-white/[0.03] text-white/20 cursor-not-allowed"
              : aiLoading
              ? "bg-purple-500/20 text-purple-300 animate-pulse"
              : "bg-gradient-to-r from-fuchsia-500 via-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/25 active:scale-[0.98]"
          }`}
        >
          {aiLoading ? "Analizuje Twoja rutyne..." : "&#129302; AI Ocena rutyny"}
        </button>

        {/* AI Result */}
        {aiResult && (
          <div className="mt-4 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-start gap-2">
              <span className="text-lg">&#129302;</span>
              <div>
                <p className="text-[9px] tracking-[1.5px] uppercase font-semibold text-purple-400/60 mb-1">AI Ocena</p>
                <p className="text-white/70 text-sm leading-relaxed">{aiResult}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tip */}
        <div className="mt-6 p-4 rounded-[18px] bg-white/[0.03] border border-amber-400/15">
          <div className="flex items-start gap-3">
            <span className="text-base mt-0.5">&#10024;</span>
            <div>
              <p className="text-[9px] tracking-[1.5px] uppercase font-semibold text-amber-300/70 mb-1.5">Beauty Tip</p>
              <p className="text-white/60 text-[12px] leading-relaxed font-medium">
                Kolejność nakładania kosmetyków ma znaczenie! Od najlżejszej konsystencji do najgęściejszej. Serum przed kremem, tonik przed serum.
              </p>
            </div>
          </div>
        </div>

        {/* Back link */}
        <Link
          href="/"
          className="block text-center mt-6 text-white/30 text-xs font-semibold hover:text-white/50 transition-colors"
        >
          Powrót do skanera
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}
