"use client";

import { useState, useEffect } from "react";
import { getBACSession, totalDrinkCalories, alcoholCalorieComparisons, clearBACSession } from "@/lib/bac";

export default function MorningAfter() {
  const [session, setSession] = useState<ReturnType<typeof getBACSession>>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const s = getBACSession();
    if (!s || s.drinks.length === 0) return;

    // Only show if session is from yesterday or last night (>4h ago, <24h ago)
    const start = new Date(s.startTime);
    const hoursAgo = (Date.now() - start.getTime()) / (1000 * 60 * 60);
    if (hoursAgo > 4 && hoursAgo < 24) {
      setSession(s);
    }
  }, []);

  if (!session || dismissed) return null;

  const drinks = session.drinks;
  const calories = totalDrinkCalories(drinks);
  const comparisons = alcoholCalorieComparisons(calories);
  const startTime = new Date(session.startTime);
  const lastDrink = new Date(drinks[drinks.length - 1].time);

  const handleDismiss = () => {
    clearBACSession();
    setDismissed(true);
  };

  return (
    <div className="card-elevated rounded-[24px] p-5 mb-4 border-l-4 border-l-amber-400 anim-fade-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌅</span>
          <div>
            <p className="text-[14px] font-bold text-[#1A3A0A]">Poranny raport</p>
            <p className="text-[10px] text-gray-400">Wczorajszy wieczór w liczbach</p>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-gray-300 text-[14px] px-1">✕</button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-gray-50 rounded-[12px] p-2.5 text-center">
          <p className="text-[18px] font-black text-[#1A3A0A]">{drinks.length}</p>
          <p className="text-[9px] text-gray-400 font-semibold">drinków</p>
        </div>
        <div className="bg-gray-50 rounded-[12px] p-2.5 text-center">
          <p className="text-[18px] font-black text-amber-600">{calories}</p>
          <p className="text-[9px] text-gray-400 font-semibold">kcal</p>
        </div>
        <div className="bg-gray-50 rounded-[12px] p-2.5 text-center">
          <p className="text-[12px] font-bold text-gray-600">
            {startTime.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
            {" – "}
            {lastDrink.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-[9px] text-gray-400 font-semibold">czas picia</p>
        </div>
      </div>

      {comparisons.length > 0 && (
        <div className="bg-amber-50 rounded-[14px] p-3 mb-3">
          <p className="text-[10px] text-amber-700 font-semibold mb-1">{calories} kcal z alkoholu to tyle co:</p>
          <ul className="space-y-0.5">
            {comparisons.slice(0, 3).map((c, i) => (
              <li key={i} className="text-[11px] text-amber-600">{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-[#EBF5D5] rounded-[14px] p-3">
        <p className="text-[11px] text-[#2D5A16] font-medium">
          💡 Dziś lekki dzień. Dużo wody, białko, warzywa. Twoje ciało potrzebuje regeneracji.
        </p>
      </div>
    </div>
  );
}
