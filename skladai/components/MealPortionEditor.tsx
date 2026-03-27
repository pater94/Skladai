"use client";

import { useState, useMemo } from "react";
import { MealItem } from "@/lib/types";

interface Props {
  items: MealItem[];
  isDark?: boolean;
}

export default function MealPortionEditor({ items: initialItems, isDark = true }: Props) {
  const [weights, setWeights] = useState<Record<number, number>>(
    Object.fromEntries(initialItems.map((item, i) => [i, item.estimated_weight_g]))
  );

  const recalcItem = (item: MealItem, newWeight: number) => ({
    ...item,
    calories: Math.round(item.calories_per_100g * newWeight / 100),
    protein: Math.round(item.protein_per_100g * newWeight / 100 * 10) / 10,
    fat: Math.round(item.fat_per_100g * newWeight / 100 * 10) / 10,
    carbs: Math.round(item.carbs_per_100g * newWeight / 100 * 10) / 10,
  });

  const adjustedItems = useMemo(() =>
    initialItems.map((item, i) => recalcItem(item, weights[i] || item.estimated_weight_g)),
    [initialItems, weights]
  );

  const total = useMemo(() =>
    adjustedItems.reduce(
      (sum, item) => ({
        calories: sum.calories + item.calories,
        protein: sum.protein + item.protein,
        fat: sum.fat + item.fat,
        carbs: sum.carbs + item.carbs,
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    ),
    [adjustedItems]
  );

  return (
    <div className={`rounded-[20px] p-5 ${isDark ? "velvet-card" : "card-elevated"}`}>
      <p className={`text-[13px] font-bold mb-1 ${isDark ? "text-white" : "text-[#1A3A0A]"}`}>
        🍽️ Korekta porcji
      </p>
      <p className={`text-[10px] mb-4 ${isDark ? "text-white/30" : "text-gray-400"}`}>
        Przesuń suwak żeby dopasować wagę do rzeczywistej porcji
      </p>

      <div className="space-y-5">
        {initialItems.map((item, i) => {
          const w = weights[i] || item.estimated_weight_g;
          const adjusted = adjustedItems[i];
          return (
            <div key={i}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[12px] font-semibold ${isDark ? "text-white/70" : "text-gray-700"}`}>
                  {item.name}
                </span>
                <span className={`text-[12px] font-bold ${isDark ? "text-white" : "text-[#1A3A0A]"}`}>
                  {adjusted.calories} kcal
                </span>
              </div>

              {/* Weight value bubble */}
              <div className="flex justify-center mb-1">
                <span className={`text-[14px] font-black px-3 py-0.5 rounded-full ${
                  isDark ? "bg-white/10 text-white" : "bg-emerald-50 text-emerald-700"
                }`}>
                  {w}g
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] w-9 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                  {Math.max(item.min_reasonable_g, Math.round(item.estimated_weight_g * 0.2))}g
                </span>
                <input
                  type="range"
                  min={Math.max(1, Math.round(item.estimated_weight_g * 0.2))}
                  max={Math.max(item.max_reasonable_g, Math.round(item.estimated_weight_g * 3))}
                  step={1}
                  value={w}
                  onInput={(e) => setWeights({ ...weights, [i]: +(e.target as HTMLInputElement).value })}
                  onChange={(e) => setWeights({ ...weights, [i]: +e.target.value })}
                  className="flex-1 h-[44px] appearance-none bg-transparent cursor-pointer"
                  style={{
                    WebkitAppearance: "none",
                  }}
                />
                <span className={`text-[10px] w-9 text-right ${isDark ? "text-white/30" : "text-gray-400"}`}>
                  {Math.max(item.max_reasonable_g, Math.round(item.estimated_weight_g * 3))}g
                </span>
              </div>

              <div className="flex justify-between mt-0.5">
                <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>
                  {w !== item.estimated_weight_g && `AI: ~${item.estimated_weight_g}g`}
                </span>
                <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-300"}`}>
                  B:{adjusted.protein}g T:{adjusted.fat}g W:{adjusted.carbs}g
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className={`mt-5 pt-4 border-t ${isDark ? "border-white/10" : "border-gray-200"}`}>
        <div className="flex justify-between items-center">
          <span className={`text-[14px] font-bold ${isDark ? "text-white" : "text-[#1A3A0A]"}`}>
            Suma (po korekcie)
          </span>
          <span className={`text-[18px] font-black ${isDark ? "text-white" : "text-[#1A3A0A]"}`}>
            {Math.round(total.calories)} kcal
          </span>
        </div>
        <div className="flex gap-4 mt-1">
          <span className={`text-[11px] ${isDark ? "text-white/40" : "text-gray-400"}`}>💪 {Math.round(total.protein * 10) / 10}g</span>
          <span className={`text-[11px] ${isDark ? "text-white/40" : "text-gray-400"}`}>🫧 {Math.round(total.fat * 10) / 10}g</span>
          <span className={`text-[11px] ${isDark ? "text-white/40" : "text-gray-400"}`}>🍞 {Math.round(total.carbs * 10) / 10}g</span>
        </div>
      </div>
    </div>
  );
}
