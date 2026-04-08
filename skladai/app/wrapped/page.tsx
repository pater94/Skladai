"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getHistory, getWeekTotals, getStreak, isPremium } from "@/lib/storage";
import PremiumGate from "@/components/PremiumGate";
import { getScoreColor } from "@/components/ScoreRing";
import { ScanHistoryItem, DailyTotals } from "@/lib/types";

export default function WrappedPage() {
  const router = useRouter();
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [weekTotals, setWeekTotals] = useState<DailyTotals[]>([]);
  const [streak, setStreak] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const shareAsImage = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#1A3A0A",
        scale: 2,
        useCORS: true,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        if (navigator.share) {
          const file = new File([blob], "skladai-wrapped.png", { type: "image/png" });
          navigator.share({ files: [file], title: "Mój tydzień w SkładAI" }).catch(() => {});
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "skladai-wrapped.png";
          a.click();
          URL.revokeObjectURL(url);
        }
      }, "image/png");
    } catch {
      // Fallback: just download
      alert("Zrób screenshot tej strony!");
    }
  }, []);

  const [hasPremium, setHasPremium] = useState(false);

  useEffect(() => {
    setHistory(getHistory());
    setWeekTotals(getWeekTotals());
    setStreak(getStreak());
    setHasPremium(isPremium());
    setLoaded(true);
  }, []);

  if (loaded && !hasPremium) {
    return <PremiumGate feature="Weekly Wrapped — tygodniowe podsumowanie" isPremium={false}><div /></PremiumGate>;
  }

  if (!loaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F5F2EB]">
        <div className="w-12 h-12 border-4 border-[#2D5A16] border-t-transparent rounded-full" style={{ animation: "spinSlow 0.8s linear infinite" }} />
      </div>
    );
  }

  // This week's scans
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const thisWeek = history.filter((h) => new Date(h.date) >= weekStart);
  const totalScans = thisWeek.length;
  const avgScore = totalScans > 0 ? Math.round(thisWeek.reduce((s, h) => s + h.score, 0) / totalScans * 10) / 10 : 0;

  // Best and worst
  const sorted = [...thisWeek].sort((a, b) => b.score - a.score);
  const best = sorted[0] || null;
  const worst = sorted[sorted.length - 1] || null;

  // Sugar from diary
  const totalSugar = weekTotals.reduce((s, d) => s + d.sugar, 0);
  const sugarTeaspoons = Math.round(totalSugar / 4);

  // Calorie trend
  const maxCal = Math.max(...weekTotals.map((d) => d.calories), 1);

  const dayNames = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];

  return (
    <div className="min-h-[100dvh] bg-[#1A3A0A]">
      <div className="max-w-md mx-auto px-5 pt-10 pb-24">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-[10px] text-lime-400/50 uppercase tracking-[3px] font-semibold">📊 Weekly Wrapped</p>
          <h1 className="text-[24px] font-black text-white mt-2">Twój tydzień w SkładAI</h1>
          <p className="text-white/30 text-[12px] mt-1">
            {weekStart.toLocaleDateString("pl-PL", { day: "numeric", month: "short" })} — {new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
          </p>
        </div>

        {totalScans === 0 ? (
          <div className="text-center py-12">
            <span className="text-5xl block mb-4">😴</span>
            <p className="text-white/50 text-[14px] font-semibold">Ten tydzień był cichy</p>
            <p className="text-white/25 text-[12px] mt-1">Wróć do gry — zeskanuj coś!</p>
            <button onClick={() => router.push("/")}
              className="mt-6 px-8 py-3 bg-lime-500 text-[#1A3A0A] font-bold rounded-full active:scale-[0.97] transition-all">
              📸 Skanuj
            </button>
          </div>
        ) : (
          <div className="space-y-4" ref={cardRef}>
            {/* Main stats */}
            <div className="bg-white/5 rounded-[20px] p-5 text-center border border-white/5">
              <p className="text-[36px] font-black text-white">{totalScans}</p>
              <p className="text-white/40 text-[12px] font-semibold">produktów zeskanowanych</p>
              <p className="text-[28px] font-black text-lime-400 mt-2">{avgScore}</p>
              <p className="text-white/40 text-[12px] font-semibold">średnia ocena</p>
            </div>

            {/* Best & Worst */}
            {best && worst && best.id !== worst.id && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[18px] p-4">
                  <p className="text-[10px] text-emerald-400 font-semibold mb-2">🏆 NAJLEPSZY</p>
                  <p className="text-[12px] font-bold text-white truncate">{best.name}</p>
                  <p className="text-[20px] font-black text-emerald-400 mt-1">{best.score}/10</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-[18px] p-4">
                  <p className="text-[10px] text-red-400 font-semibold mb-2">😬 NAJGORSZY</p>
                  <p className="text-[12px] font-bold text-white truncate">{worst.name}</p>
                  <p className="text-[20px] font-black text-red-400 mt-1">{worst.score}/10</p>
                </div>
              </div>
            )}

            {/* Calorie chart */}
            {weekTotals.some((d) => d.calories > 0) && (
              <div className="bg-white/5 rounded-[20px] p-5 border border-white/5">
                <p className="text-[12px] text-white/40 font-semibold mb-3">📈 Kalorie w tygodniu</p>
                <div className="flex items-end gap-1 h-24">
                  {weekTotals.map((d, i) => {
                    const pct = maxCal > 0 ? (d.calories / maxCal) * 100 : 0;
                    const dayDate = new Date(d.date);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] text-white/30">{d.calories > 0 ? d.calories : ""}</span>
                        <div className="w-full rounded-t-[4px] bg-lime-500/30 overflow-hidden" style={{ height: `${Math.max(pct, 2)}%` }}>
                          <div className="w-full h-full bg-lime-500 rounded-t-[4px]" />
                        </div>
                        <span className="text-[9px] text-white/30">{dayNames[dayDate.getDay()]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sugar */}
            {sugarTeaspoons > 0 && (
              <div className="bg-white/5 rounded-[20px] p-5 border border-white/5 text-center">
                <p className="text-[10px] text-white/40 font-semibold mb-2">🥄 CUKIER W TYM TYGODNIU</p>
                <div className="flex flex-wrap justify-center gap-0.5 mb-2">
                  {Array.from({ length: Math.min(sugarTeaspoons, 30) }).map((_, i) => (
                    <span key={i} className="text-[14px]">🥄</span>
                  ))}
                </div>
                <p className="text-[14px] font-bold text-white">{sugarTeaspoons} łyżeczek</p>
                <p className="text-[11px] text-white/30">(norma: ~42/tydzień)</p>
              </div>
            )}

            {/* Streak */}
            {streak > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-[20px] p-5 text-center">
                <p className="text-[32px] font-black text-orange-400">🔥 {streak}</p>
                <p className="text-[12px] text-white/40 font-semibold">{streak === 1 ? "dzień" : "dni"} z rzędu!</p>
              </div>
            )}

            {/* Footer branding */}
            <div className="text-center pt-4">
              <p className="text-white/20 text-[10px]">📱 skladai.com</p>
              <p className="text-white/15 text-[9px] mt-0.5">Sprawdź co naprawdę jesz.</p>
            </div>
          </div>
        )}

        {/* Share button */}
        {totalScans > 0 && (
          <button onClick={shareAsImage}
            className="w-full mt-4 py-4 bg-gradient-to-r from-lime-500 to-emerald-500 text-white font-bold rounded-[18px] active:scale-[0.97] transition-all text-[15px] shadow-xl">
            📤 Udostępnij na Instagram / wyślij znajomemu
          </button>
        )}

        {/* Back button */}
        <button onClick={() => router.push("/")}
          className="w-full mt-6 py-3 text-[13px] text-white/30 font-semibold">
          ← Powrót
        </button>
      </div>
    </div>
  );
}
