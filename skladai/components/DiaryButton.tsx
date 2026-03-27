"use client";

import { useState } from "react";
import { FoodAnalysisResult, MealAnalysisResult, MealType } from "@/lib/types";
import { addDiaryEntry, todayStr } from "@/lib/storage";

interface Props {
  result: FoodAnalysisResult | MealAnalysisResult;
  scanId: string;
  isDark?: boolean;
}

const MEAL_TYPES: { id: MealType; icon: string; label: string }[] = [
  { id: "breakfast", icon: "🌅", label: "Śniadanie" },
  { id: "lunch", icon: "☀️", label: "Obiad" },
  { id: "dinner", icon: "🌙", label: "Kolacja" },
  { id: "snack", icon: "🍿", label: "Przekąska" },
];

function parseNutritionValue(val: string): number {
  const match = val?.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

export default function DiaryButton({ result, scanId, isDark = false }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [portion, setPortion] = useState(100);
  const [added, setAdded] = useState(false);

  const isMeal = "items" in result && result.items;

  // Parse nutrition from food result
  let cal100 = 0, prot100 = 0, fat100 = 0, carb100 = 0, sugar100 = 0, salt100 = 0, fiber100 = 0;
  let packageG = 100;

  if (isMeal) {
    const meal = result as MealAnalysisResult;
    const t = meal.total;
    // For meals, values are already per-meal, not per 100g
    cal100 = t.calories;
    prot100 = t.protein;
    fat100 = t.fat;
    carb100 = t.carbs;
    packageG = 1; // portion = 1 means full meal
  } else {
    const food = result as FoodAnalysisResult;
    const nutr = food.nutrition || [];
    for (const n of nutr) {
      const v = parseNutritionValue(n.value);
      if (n.label.toLowerCase().includes("energ")) cal100 = v;
      if (n.label.toLowerCase().includes("tłuszcz") && !n.sub) fat100 = v;
      if (n.label.toLowerCase().includes("węglo")) { carb100 = v; if (n.sub) { sugar100 = parseNutritionValue(n.sub); } }
      if (n.label.toLowerCase().includes("biał")) prot100 = v;
      if (n.label.toLowerCase().includes("sól") || n.label.toLowerCase().includes("sol")) salt100 = v;
    }
    const wMatch = food.weight?.match(/(\d+)/);
    packageG = wMatch ? parseInt(wMatch[1]) : 200;
  }

  const factor = isMeal ? 1 : portion / 100;
  const portionCal = Math.round(cal100 * factor);
  const portionProt = Math.round(prot100 * factor * 10) / 10;
  const portionFat = Math.round(fat100 * factor * 10) / 10;
  const portionCarb = Math.round(carb100 * factor * 10) / 10;

  const handleAdd = () => {
    addDiaryEntry({
      date: todayStr(),
      mealType,
      productName: result.name,
      brand: result.brand || "",
      score: result.score,
      portion_g: isMeal ? 1 : portion,
      package_g: packageG,
      calories: portionCal,
      protein: portionProt,
      fat: portionFat,
      carbs: portionCarb,
      sugar: Math.round(sugar100 * factor * 10) / 10,
      salt: Math.round(salt100 * factor * 10) / 10,
      fiber: Math.round(fiber100 * factor * 10) / 10,
      scanId,
    });
    setAdded(true);
    setTimeout(() => setShowModal(false), 1000);
  };

  if (added) {
    return (
      <div className={`w-full py-4 rounded-[18px] text-center font-bold text-[15px] ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
        ✅ Dodano do dziennika!
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`w-full py-4 rounded-[18px] font-bold text-[15px] active:scale-[0.97] transition-all ${
          isDark ? "bg-white/5 border border-white/10 text-white/70" : "card-elevated text-[#1A3A0A]"
        }`}
      >
        📝 Dodaj do dziennika
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md bg-white rounded-t-[28px] p-6 pb-10" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />
            <h3 className="text-[18px] font-bold text-[#1A3A0A] mb-4">📝 Dodaj do dziennika</h3>

            {/* Product name */}
            <p className="text-[14px] font-semibold text-gray-700 mb-4">{result.name}</p>

            {/* Meal type */}
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Posiłek</p>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {MEAL_TYPES.map((m) => (
                <button key={m.id} onClick={() => setMealType(m.id)}
                  className={`py-2.5 rounded-[12px] text-center transition-all ${
                    mealType === m.id ? "bg-[#1A3A0A] text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                  <span className="text-[16px] block">{m.icon}</span>
                  <span className="text-[10px] font-bold block mt-0.5">{m.label}</span>
                </button>
              ))}
            </div>

            {/* Portion slider (not for meals) */}
            {!isMeal && (
              <div className="mb-5">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Porcja: {portion}g</p>
                <input type="range" min={10} max={Math.max(packageG, 200)} step={5} value={portion}
                  onChange={(e) => setPortion(+e.target.value)} className="w-full accent-[#1A3A0A]" />
                <div className="flex justify-between text-[10px] text-gray-300 mt-1">
                  <span>10g</span>
                  <span>{Math.max(packageG, 200)}g</span>
                </div>
              </div>
            )}

            {/* Nutrition preview */}
            <div className="bg-[#EBF5D5] rounded-[16px] p-4 mb-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[13px] font-bold text-[#2D5A16]">⚡ {portionCal} kcal</span>
                <span className="text-[11px] text-[#2D5A16]/50">{isMeal ? "cały posiłek" : `za ${portion}g`}</span>
              </div>
              <div className="flex gap-3 text-[11px] text-[#2D5A16]/70">
                <span>💪 {portionProt}g</span>
                <span>🫧 {portionFat}g</span>
                <span>🍞 {portionCarb}g</span>
              </div>
            </div>

            {/* Add button */}
            <button onClick={handleAdd}
              className="w-full py-4 bg-[#1A3A0A] text-white font-bold rounded-[18px] active:scale-[0.97] transition-all text-[15px] shadow-xl">
              ✅ Dodaj
            </button>
          </div>
        </div>
      )}
    </>
  );
}
