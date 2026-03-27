"use client";

import { useState } from "react";
import { UserProfile, FoodAnalysisResult } from "@/lib/types";

interface Props {
  result: FoodAnalysisResult;
  profile: UserProfile;
}

export default function HealthAlerts({ result, profile }: Props) {
  const [sliderWeight, setSliderWeight] = useState(100);
  const isDark = false; // food is always matcha theme

  const health = profile.health;
  const allergyInfo = result.allergy_info;
  const diabetesInfo = result.diabetes_info;
  const pregnancyInfo = result.pregnancy_info;

  // === ALLERGEN ALERT ===
  const userAllergens = health.allergens || [];
  const detectedAllergens = allergyInfo?.detected_allergens || result.allergens || [];
  const mayContain = allergyInfo?.may_contain || [];
  const matchedAllergens = detectedAllergens.filter((a) =>
    userAllergens.some((ua) => a.toLowerCase().includes(ua.toLowerCase()) || ua.toLowerCase().includes(a.toLowerCase()))
  );
  const hasAllergenAlert = matchedAllergens.length > 0;

  // === DIABETES ===
  const hasDiabetes = !!health.diabetes;
  const ww100g = diabetesInfo?.ww_per_100g || 0;
  const wwSlider = Math.round(ww100g * sliderWeight / 100 * 10) / 10;
  const gi = diabetesInfo?.glycemic_index || "średni";
  const giBadge = gi === "niski" ? "🟢" : gi === "średni" ? "🟡" : "🔴";
  const diabetesBadge = diabetesInfo?.diabetes_badge || "caution";

  // Parse weight from product for slider max
  const weightMatch = result.weight?.match(/(\d+)/);
  const packageWeight = weightMatch ? parseInt(weightMatch[1]) : 200;

  // === PREGNANCY / BREASTFEEDING ===
  const isPregnant = health.pregnancy === "t1" || health.pregnancy === "t2" || health.pregnancy === "t3";
  const isBreastfeeding = health.pregnancy === "karmienie";
  const isPlanning = health.pregnancy === "planuje";
  const showPregnancyAlerts = isPregnant || isBreastfeeding || isPlanning;
  const pregAlerts = pregnancyInfo?.alerts || [];
  const safePregNutrients = pregnancyInfo?.safe_nutrients || [];
  const caffeineMg = pregnancyInfo?.caffeine_mg || 0;

  return (
    <div className="space-y-3">
      {/* ALLERGEN ALERT — BIG RED BANNER */}
      {hasAllergenAlert && (
        <div className="bg-red-600 rounded-[20px] p-5 anim-fade-scale">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🚫</span>
            <div>
              <p className="text-white font-black text-[16px]">ALERGEN WYKRYTY!</p>
              <p className="text-white/70 text-[12px] font-medium">Ten produkt NIE jest dla Ciebie</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {matchedAllergens.map((a, i) => (
              <span key={i} className="bg-white/20 text-white text-[12px] font-bold px-3 py-1.5 rounded-full">
                {a}
              </span>
            ))}
          </div>
          {mayContain.length > 0 && (
            <p className="text-white/50 text-[11px] mt-3">
              Może zawierać: {mayContain.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* DIABETES PANEL */}
      {hasDiabetes && diabetesInfo && (
        <div className={`rounded-[20px] p-5 ${isDark ? "velvet-card" : "card-elevated"} border-l-4 ${
          diabetesBadge === "friendly" ? "border-l-emerald-500" : diabetesBadge === "caution" ? "border-l-amber-500" : "border-l-red-500"
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold text-[#1A3A0A]">🩸 Panel cukrzyka</h3>
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${
              diabetesBadge === "friendly" ? "bg-emerald-100 text-emerald-700" : diabetesBadge === "caution" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
            }`}>
              {diabetesBadge === "friendly" ? "🟢 PRZYJAZNY" : diabetesBadge === "caution" ? "🟡 OSTROŻNIE" : "🔴 UWAŻAJ"}
            </span>
          </div>

          {/* IG Badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[13px]">{giBadge}</span>
            <span className="text-[12px] font-semibold text-gray-600">Indeks glikemiczny: {gi}</span>
          </div>

          {/* WW Display */}
          <div className="bg-[#EBF5D5] rounded-[16px] p-4 mb-3">
            <p className="text-[11px] text-[#2D5A16]/60 font-semibold">WYMIENNIKI WĘGLOWODANOWE</p>
            <p className="text-[28px] font-black text-[#1A3A0A]">{wwSlider} WW</p>
            <p className="text-[11px] text-[#2D5A16]/50">dla {sliderWeight}g produktu</p>
          </div>

          {/* SLIDER */}
          <div>
            <div className="flex justify-between text-[10px] text-gray-400 font-semibold mb-1">
              <span>10g</span>
              <span className="font-bold text-[#1A3A0A]">{sliderWeight}g</span>
              <span>{packageWeight}g</span>
            </div>
            <input
              type="range"
              min={10}
              max={packageWeight}
              step={5}
              value={sliderWeight}
              onChange={(e) => setSliderWeight(+e.target.value)}
              className="w-full accent-[#1A3A0A]"
            />
          </div>

          {/* Diabetes tip */}
          {diabetesInfo.diabetes_tip && (
            <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
              💡 {diabetesInfo.diabetes_tip}
            </p>
          )}

          <p className="text-[9px] text-gray-300 mt-2">
            ⚠️ Wartości orientacyjne. Decyzje o insulinie podejmuj z lekarzem.
          </p>
        </div>
      )}

      {/* BREASTFEEDING PANEL */}
      {isBreastfeeding && (
        <div className="card-elevated rounded-[20px] p-5 border-l-4 border-l-sky-400">
          <h3 className="text-[14px] font-bold text-[#1A3A0A] mb-3">🤱 Karmienie piersią</h3>

          {pregAlerts.length > 0 && (
            <div className="space-y-2 mb-3">
              {pregAlerts.map((alert, i) => (
                <div key={i} className="flex items-center gap-2 bg-red-50 rounded-[12px] p-2.5">
                  <span className="text-[13px]">⚠️</span>
                  <span className="text-[12px] font-semibold text-red-600">{alert}</span>
                </div>
              ))}
            </div>
          )}

          {caffeineMg > 0 && (
            <div className="bg-amber-50 rounded-[12px] p-3 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-semibold text-amber-700">☕ Kofeina</span>
                <span className="text-[14px] font-bold text-amber-700">{caffeineMg}mg</span>
              </div>
              <div className="w-full h-2 rounded-full bg-amber-200 mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${caffeineMg > 200 ? "bg-red-500" : caffeineMg > 100 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min((caffeineMg / 300) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-amber-600/60 mt-1">{caffeineMg}/300mg dziennego limitu przy karmieniu</p>
            </div>
          )}

          {safePregNutrients.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-gray-400 font-semibold mb-1.5">✅ Korzystne składniki:</p>
              <div className="flex flex-wrap gap-1.5">
                {safePregNutrients.map((n, i) => (
                  <span key={i} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">{n}</span>
                ))}
              </div>
            </div>
          )}

          <p className="text-[9px] text-gray-300 mt-3">
            ⚠️ Podczas karmienia piersią unikaj alkoholu, ogranicz kofeinę. Konsultuj z lekarzem.
          </p>
        </div>
      )}

      {/* PREGNANCY PANEL */}
      {isPregnant && (
        <div className="card-elevated rounded-[20px] p-5 border-l-4 border-l-pink-400">
          <h3 className="text-[14px] font-bold text-[#1A3A0A] mb-3">🤰 Panel ciąży</h3>

          {/* Alerts */}
          {pregAlerts.length > 0 && (
            <div className="space-y-2 mb-3">
              {pregAlerts.map((alert, i) => (
                <div key={i} className="flex items-center gap-2 bg-red-50 rounded-[12px] p-2.5">
                  <span className="text-[13px]">⚠️</span>
                  <span className="text-[12px] font-semibold text-red-600">{alert}</span>
                </div>
              ))}
            </div>
          )}

          {/* Safe nutrients */}
          {safePregNutrients.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-gray-400 font-semibold mb-1.5">✅ Korzystne składniki:</p>
              <div className="flex flex-wrap gap-1.5">
                {safePregNutrients.map((n, i) => (
                  <span key={i} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">{n}</span>
                ))}
              </div>
            </div>
          )}

          {/* Caffeine */}
          {caffeineMg > 0 && (
            <div className="bg-amber-50 rounded-[12px] p-3">
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-semibold text-amber-700">☕ Kofeina</span>
                <span className="text-[14px] font-bold text-amber-700">{caffeineMg}mg</span>
              </div>
              <div className="w-full h-2 rounded-full bg-amber-200 mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${caffeineMg > 200 ? "bg-red-500" : caffeineMg > 100 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min((caffeineMg / 200) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-amber-600/60 mt-1">{caffeineMg}/200mg dziennego limitu w ciąży</p>
            </div>
          )}

          <p className="text-[9px] text-gray-300 mt-3">
            ⚠️ W razie wątpliwości skonsultuj się z lekarzem prowadzącym.
          </p>
        </div>
      )}
    </div>
  );
}
