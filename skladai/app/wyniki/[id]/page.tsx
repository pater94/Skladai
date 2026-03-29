// @ts-nocheck
"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ScanHistoryItem, CosmeticsAnalysisResult, FoodAnalysisResult, MealAnalysisResult, TextSearchResult, CheckFormResult, UserProfile, MealType } from "@/lib/types";
import { getHistoryItem, getProfile, addDiaryEntry, todayStr } from "@/lib/storage";
import ScoreRing, { getScoreColor } from "@/components/ScoreRing";
import ResultTabs from "@/components/ResultTabs";
import HealthAlerts from "@/components/HealthAlerts";
import MealPortionEditor from "@/components/MealPortionEditor";
import IngredientPopup from "@/components/IngredientPopup";

function FunComparisons({ items, isDark }: { items: string[]; isDark: boolean }): React.JSX.Element {
  if (!items || items.length === 0) return <></>;
  return (
    <div className={`mt-3 rounded-[20px] p-5 anim-fade-up-1 ${isDark ? "velvet-card" : "card-elevated"}`}>
      <p className={`text-[13px] font-bold mb-3 ${isDark ? "text-white" : "text-[#1A3A0A]"}`}>
        Ciekawostki
      </p>
      <ul className="space-y-2">
        {items.map((c: string, i: number) => (
          <li key={i} className={`text-[12px] leading-relaxed ${isDark ? "text-white/55" : "text-gray-600"}`}>
            {String(c)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SugarSpoons({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  const full = Math.floor(count);
  const hasHalf = count - full >= 0.3;
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {Array.from({ length: Math.min(full, 15) }).map((_, i) => (
        <span key={i} className="text-[16px]">🥄</span>
      ))}
      {hasHalf && <span className="text-[12px] opacity-50">🥄</span>}
      {full > 15 && <span className="text-[11px] text-gray-400 ml-1">+{full - 15}</span>}
    </div>
  );
}

/* ── helpers to parse nutrition from food results ── */
function parseNutritionValue(val: string): number {
  const match = val?.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function extractFoodNutrition(food: FoodAnalysisResult) {
  let cal100 = 0, prot100 = 0, fat100 = 0, carb100 = 0, sugar100 = 0, salt100 = 0, fiber100 = 0;
  const nutr = food.nutrition || [];
  for (const n of nutr) {
    const v = parseNutritionValue(n.value);
    if (n.label.toLowerCase().includes("energ")) cal100 = v;
    if (n.label.toLowerCase().includes("tluszcz") || n.label.toLowerCase().includes("tłuszcz")) { if (!n.sub) fat100 = v; }
    if (n.label.toLowerCase().includes("weglo") || n.label.toLowerCase().includes("węglo")) { carb100 = v; if (n.sub) sugar100 = parseNutritionValue(n.sub); }
    if (n.label.toLowerCase().includes("bial") || n.label.toLowerCase().includes("biał")) prot100 = v;
    if (n.label.toLowerCase().includes("sol") || n.label.toLowerCase().includes("sól")) salt100 = v;
    if (n.label.toLowerCase().includes("blonnik") || n.label.toLowerCase().includes("błonnik")) fiber100 = v;
  }
  const wMatch = food.weight?.match(/(\d+)/);
  const packageG = wMatch ? parseInt(wMatch[1]) : 200;
  return { cal100, prot100, fat100, carb100, sugar100, salt100, fiber100, packageG };
}

/* ── Meal type options ── */
const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Śniadanie" },
  { id: "lunch", label: "Obiad" },
  { id: "dinner", label: "Kolacja" },
  { id: "snack", label: "Przekąska" },
];

/* ── Inline diary panel ── */
function DiaryPanel({
  result,
  scanId,
  isDark,
}: {
  result: FoodAnalysisResult | MealAnalysisResult;
  scanId: string;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [pct, setPct] = useState(100);
  const [added, setAdded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const isMeal = "items" in result && result.items;

  let cal100 = 0, prot100 = 0, fat100 = 0, carb100 = 0, sugar100 = 0, salt100 = 0, fiber100 = 0;
  let packageG = 100;

  if (isMeal) {
    const meal = result as MealAnalysisResult;
    const t = meal.total;
    cal100 = t.calories;
    prot100 = t.protein;
    fat100 = t.fat;
    carb100 = t.carbs;
    packageG = 1;
  } else {
    const n = extractFoodNutrition(result as FoodAnalysisResult);
    cal100 = n.cal100; prot100 = n.prot100; fat100 = n.fat100; carb100 = n.carb100;
    sugar100 = n.sugar100; salt100 = n.salt100; fiber100 = n.fiber100; packageG = n.packageG;
  }

  const factor = isMeal ? (pct / 100) : (pct / 100);
  const portionG = isMeal ? Math.round(packageG * factor) : Math.round(packageG * factor);
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
      portion_g: isMeal ? factor : portionG,
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
  };

  if (added) {
    return (
      <div className={`w-full py-4 rounded-[18px] text-center font-bold text-[15px] ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
        Dodano do dziennika!
      </div>
    );
  }

  return (
    <div>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full py-4 rounded-[18px] font-bold text-[15px] active:scale-[0.97] transition-all ${
          isDark
            ? "bg-white/5 border border-white/10 text-white/70"
            : "card-elevated text-[#1A3A0A]"
        }`}
      >
        {open ? "📝 Schowaj panel" : "📝 Dodaj do dziennika"}
      </button>

      {/* Expandable panel */}
      <div
        ref={panelRef}
        style={{
          maxHeight: open ? "600px" : "0px",
          opacity: open ? 1 : 0,
          transition: "max-height 0.3s ease, opacity 0.25s ease",
          overflow: "hidden",
        }}
      >
        <div className={`mt-3 rounded-[20px] p-5 ${isDark ? "bg-white/[0.04] border border-white/[0.08]" : "card-elevated"}`}>
          {/* Slider */}
          <p className={`text-[12px] font-semibold mb-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>
            Ile zjadłeś?
          </p>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => setPct(+e.target.value)}
            className={`w-full h-2 rounded-full appearance-none cursor-pointer ${isDark ? "accent-purple-400" : "accent-[#1A3A0A]"}`}
          />
          <div className="flex justify-between mt-1">
            <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-300"}`}>0%</span>
            <span className={`text-[12px] font-bold ${isDark ? "text-white/70" : "text-[#1A3A0A]"}`}>{pct}%</span>
            <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-300"}`}>100%</span>
          </div>

          {/* Portion info */}
          <p className={`text-[12px] mt-3 ${isDark ? "text-white/40" : "text-gray-400"}`}>
            {isMeal
              ? `Porcja: ${pct}% posiłku`
              : `Porcja: ${portionG}g z ${packageG}g (${pct}%)`}
          </p>

          {/* Recalculated macros */}
          <div className={`mt-2 rounded-[14px] px-4 py-3 ${isDark ? "bg-white/[0.04]" : "bg-[#EBF5D5]"}`}>
            <span className={`text-[13px] font-bold ${isDark ? "text-white/80" : "text-[#2D5A16]"}`}>
              {portionCal} kcal
            </span>
            <span className={`text-[12px] ml-3 ${isDark ? "text-white/40" : "text-[#2D5A16]/60"}`}>
              B: {portionProt}g | T: {portionFat}g | W: {portionCarb}g
            </span>
          </div>

          {/* Meal type pills */}
          <p className={`text-[11px] font-semibold mt-4 mb-2 uppercase tracking-wider ${isDark ? "text-white/30" : "text-gray-400"}`}>
            Posiłek
          </p>
          <div className="flex gap-2">
            {MEAL_TYPES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMealType(m.id)}
                className={`flex-1 py-2 rounded-full text-[11px] font-bold transition-all ${
                  mealType === m.id
                    ? isDark
                      ? "bg-purple-500/30 text-purple-300 border border-purple-500/40"
                      : "bg-[#1A3A0A] text-white"
                    : isDark
                      ? "bg-white/[0.04] text-white/40 border border-white/[0.06]"
                      : "bg-gray-100 text-gray-500"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Add button */}
          <button
            onClick={handleAdd}
            className={`w-full mt-4 py-3.5 rounded-[16px] font-bold text-[14px] active:scale-[0.97] transition-all ${
              isDark
                ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/20"
                : "bg-[#1A3A0A] text-white shadow-lg shadow-green-900/15"
            }`}
          >
            Dodaj
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WynikiPage() {
  const params = useParams();
  const router = useRouter();
  const [item, setItem] = useState<ScanHistoryItem | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);

  useEffect(() => {
    const id = params.id as string;
    const found = getHistoryItem(id);
    if (!found) { router.push("/"); return; }
    setItem(found);
    setProfile(getProfile());
  }, [params.id, router]);

  if (!item) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F5F2EB]">
        <div className="w-12 h-12 border-4 border-[#2D5A16] border-t-transparent rounded-full" style={{ animation: "spinSlow 0.8s linear infinite" }} />
      </div>
    );
  }

  const result = item.result;
  const scanType = item.scanType || "food";
  const isCosmetics = scanType === "cosmetics";
  const isMeal = scanType === "meal";
  const isTextSearch = result.type === "text_search";
  const isForma = scanType === "forma";
  const isSuplement = scanType === "suplement" || result.type === "suplement";
  const { color, bg, label } = getScoreColor(result.score);

  const foodResult = scanType === "food" ? (result as FoodAnalysisResult) : null;
  const textSearchResult = isTextSearch ? (result as TextSearchResult) : null;
  const cosmeticsResult = isCosmetics ? (result as CosmeticsAnalysisResult) : null;
  const mealResult = isMeal ? (result as MealAnalysisResult) : null;
  const formaResult = isForma ? (result as CheckFormResult) : null;

  const subtitle = isForma
    ? (formaResult?.score_label || "Analiza sylwetki")
    : isTextSearch
    ? "Wyszukiwanie AI"
    : isCosmetics
    ? [result.brand, cosmeticsResult?.volume, cosmeticsResult?.category].filter(Boolean).join(" · ")
    : isMeal
    ? "Analiza dania"
    : [result.brand, (result as FoodAnalysisResult).weight].filter(Boolean).join(" · ");

  const isDark = isCosmetics || isMeal || isForma || isSuplement;

  const sugarTeaspoons = foodResult?.sugar_teaspoons || textSearchResult?.sugar_teaspoons || mealResult?.sugar_teaspoons || 0;
  const funComparisons: string[] = (() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fc = (result as any)?.fun_comparisons;
    return Array.isArray(fc) ? fc.map(String) : [];
  })();

  /* ── Calculate calories for the main card ── */
  let mainCalories: number | null = null;
  if (foodResult && !isTextSearch) {
    const n = extractFoodNutrition(foodResult);
    if (n.cal100 > 0) {
      mainCalories = Math.round(n.cal100 * n.packageG / 100);
    }
  } else if (mealResult) {
    mainCalories = Math.round(mealResult.total.calories);
  } else if (textSearchResult) {
    mainCalories = Math.round(textSearchResult.total?.calories || 0);
  }

  const bgClass = isForma ? "bg-[#111111]" : isMeal ? "bg-[#1A1207]" : isCosmetics ? "bg-[#0D0B0E]" : "bg-[#F5F2EB]";
  const heroClass = isForma ? "bg-gradient-to-b from-[#1a1a2e] to-[#111111]" : isMeal ? "meal-hero" : isCosmetics ? "velvet-hero" : "matcha-hero";

  return (
    <div className={`min-h-[100dvh] ${bgClass}`}>
      {/* Header */}
      <div className={`relative overflow-hidden ${heroClass}`}>
        {isDark ? (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[80px]" />
        ) : (
          <>
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute top-10 -left-20 w-56 h-56 rounded-full bg-white/5 blur-2xl" />
          </>
        )}
        <div className="max-w-md mx-auto px-5 pt-6 pb-28 relative z-10 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className={`text-[12px] font-semibold px-3.5 py-1.5 rounded-full active:scale-95 transition-all ${
              isDark ? "text-white/60 bg-white/5 border border-white/[0.08]" : "text-white/70 bg-white/10 backdrop-blur-sm border border-white/15"
            }`}
          >
            ← Powrót
          </button>
          <button
            onClick={() => router.push(isForma ? "/forma" : "/")}
            className={`text-[12px] font-semibold px-3.5 py-1.5 rounded-full active:scale-95 transition-all ${
              isDark ? "text-white/60 bg-white/5 border border-white/[0.08]" : "text-white/70 bg-white/10 backdrop-blur-sm border border-white/15"
            }`}
          >
            Skanuj kolejny
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-5 -mt-24 pb-10 relative z-20">

        {/* ─── 1. SCORE CARD ─── */}
        <div className={`rounded-[20px] p-4 anim-fade-up ${isDark ? "velvet-card" : "glass-card"}`}>
          <div className="flex items-center gap-3.5">
            <ScoreRing score={result.score} size={68} />
            <div className="flex-1 min-w-0">
              <h1 className={`text-[16px] font-bold leading-snug ${isDark ? "text-white" : "text-[#1A3A0A]"}`}>
                {result.name}
              </h1>
              <p className={`text-[12px] mt-0.5 font-medium ${isDark ? "text-white/35" : "text-gray-400"}`}>{subtitle}</p>
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold px-3 py-1 rounded-full" style={{ backgroundColor: bg, color }}>
                  {result.verdict_short || label}
                </span>
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${isDark ? "bg-white/5 text-white/40" : "bg-gray-100 text-gray-500"}`}>
                  {isForma ? "💪 Forma" : isMeal ? "🍽️ Danie" : isTextSearch ? "🔍 Szukaj" : isCosmetics ? "✨ Kosmetyk" : isSuplement ? "💊 Suplement" : "🛒 Żywność"}
                </span>
              </div>
            </div>
          </div>

          {/* Verdict — compact, max 2 lines with expand */}
          <div className={`mt-3 p-3 rounded-xl ${isDark ? "bg-white/[0.03] border border-white/[0.06]" : "bg-[#F5F2EB]/60"}`}>
            <p className={`text-[12px] leading-relaxed ${isDark ? "text-white/55" : "text-[#1A3A0A]/65"} line-clamp-2`}>
              {result.verdict}
            </p>
          </div>

          {/* Calories on main card */}
          {mainCalories !== null && mainCalories > 0 && (
            <p className={`mt-2 text-center text-[13px] font-semibold ${isDark ? "text-white/30" : "text-[#1A3A0A]/35"}`}>
              ⚡ {mainCalories} kcal
            </p>
          )}
        </div>

        {/* ─── Meal items — interactive portion editor (meal mode) ─── */}
        {mealResult && mealResult.items && mealResult.items.length > 0 && (
          <div className="mt-4 anim-fade-up-1">
            <MealPortionEditor items={mealResult.items} isDark={isDark} />
            <p className={`text-[10px] mt-2 text-center ${isDark ? "text-white/25" : "text-gray-300"}`}>
              ⚠️ Wartości szacunkowe na podstawie zdjęcia ±20%
            </p>
          </div>
        )}

        {/* ─── 2. ALLERGEN BANNER ─── */}
        {!isCosmetics && !isMeal && !isForma && !isTextSearch && result.allergens && result.allergens.length > 0 && (
          <div className="mt-4 anim-fade-up-1">
            <div className={`rounded-[20px] p-5 ${isDark ? "bg-amber-500/10 border border-amber-500/20" : "bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100"}`}>
              <p className={`text-[13px] font-bold mb-3 ${isDark ? "text-amber-400" : "text-amber-700"}`}>⚠️ Alergeny</p>
              <div className="flex flex-wrap gap-2">
                {result.allergens.map((a, i) => (
                  <button key={i} onClick={() => setSelectedIngredient(a)} className={`text-[11px] font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform ${isDark ? "bg-amber-500/15 text-amber-400" : "bg-white/80 text-amber-700 shadow-sm border border-amber-200"}`}>
                    {a} →
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Health alerts (food only, when profile exists) */}
        {foodResult && !isTextSearch && !isForma && profile && profile.onboarding_complete && (
          <div className="mt-4 anim-fade-up-1">
            <HealthAlerts result={foodResult} profile={profile} />
          </div>
        )}

        {/* ─── 3. DIARY PANEL (food + meal) ─── */}
        {(foodResult || mealResult) && !isForma && !isTextSearch && (
          <div className="mt-4">
            <DiaryPanel
              result={(foodResult || mealResult)!}
              scanId={item.id}
              isDark={isDark}
            />
          </div>
        )}

        {/* ─── 4. TABS (food + cosmetics, not meal/forma) ─── */}
        {/* Link to recipes after fridge scan — prominent position */}
        {result.type === "fridge" && (
          <Link
            href="/przepisy"
            className="block w-full mt-4 py-4 text-center bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-bold rounded-[18px] active:scale-[0.97] transition-all text-[15px] shadow-xl shadow-orange-500/20 anim-fade-up-1"
          >
            🍳 Co ugotować z tych produktów?
          </Link>
        )}

        {!isMeal && !isForma && (
          <div className={`${isCosmetics || isSuplement ? "mt-2" : "mt-5"} anim-fade-up-2`}>
            <ResultTabs result={result} scanType={scanType} isCosmetics={isCosmetics} onIngredientClick={setSelectedIngredient} />
          </div>
        )}

        {/* ─── 6. SUGAR SPOONS & FUN COMPARISONS ─── */}
        {sugarTeaspoons > 0 ? (
          isMeal ? (
            <div className={`mt-3 flex items-center gap-2 px-4 py-2.5 rounded-full ${isDark ? "bg-white/[0.03]" : "bg-amber-50"}`}>
              <span className="text-[12px]">🥄</span>
              <span className={`text-[11px] font-semibold ${isDark ? "text-white/50" : "text-amber-700"}`}>
                {sugarTeaspoons} łyżeczek cukru
              </span>
            </div>
          ) : (
            <div className={`mt-4 rounded-[20px] p-5 anim-fade-up-1 ${isDark ? "velvet-card" : "card-elevated"}`}>
              <p className={`text-[13px] font-bold mb-2 ${isDark ? "text-white" : "text-[#1A3A0A]"}`}>
                🥄 Łyżeczki cukru: {sugarTeaspoons}
              </p>
              <SugarSpoons count={sugarTeaspoons} />
              <p className={`text-[11px] mt-2 ${isDark ? "text-white/35" : "text-gray-400"}`}>
                1 łyżeczka = 4g cukru · WHO zaleca max 6 dziennie
              </p>
            </div>
          )
        ) : null}

        {/* FunComparisons — food/meal only (cosmetics data is now in tabs) */}
        {!isCosmetics && <FunComparisons items={funComparisons} isDark={isDark} />}

        {/* CheckForm body analysis */}
        {formaResult && (
          <div className="mt-4 space-y-3 anim-fade-up-1">
            {/* Body stats */}
            <div className="rounded-[20px] p-5 bg-white/[0.04] border border-white/[0.08]">
              <h3 className="font-bold text-white text-[14px] mb-4">📊 Estymacja</h3>
              {(() => {
                const weight = profile?.weight_kg;
                const bfMatch = formaResult.body_fat_range?.match(/(\d+)-(\d+)/);
                const bfMid = bfMatch ? (parseInt(bfMatch[1]) + parseInt(bfMatch[2])) / 2 : null;
                const fatKg = weight && bfMid ? Math.round(weight * bfMid / 100 * 10) / 10 : null;
                const leanMass = weight && fatKg ? Math.round((weight - fatKg) * 10) / 10 : null;
                const muscleKg = leanMass ? Math.round(leanMass * 0.75 * 10) / 10 : null;

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-white/50">🏋️ Tkanka tłuszczowa</span>
                      <div className="text-right">
                        <span className="text-[14px] font-bold text-white">{formaResult.body_fat_range}</span>
                        {fatKg && <span className="text-[11px] text-white/40 ml-1">(~{fatKg} kg)</span>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-white/50">Kategoria</span>
                      <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                        formaResult.body_fat_category === "athletic" ? "bg-blue-500/15 text-blue-400"
                        : formaResult.body_fat_category === "fit" ? "bg-emerald-500/15 text-emerald-400"
                        : formaResult.body_fat_category === "average" ? "bg-amber-500/15 text-amber-400"
                        : "bg-red-500/15 text-red-400"
                      }`}>
                        {formaResult.body_fat_category?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-white/50">💪 Masa mięśniowa</span>
                      <div className="text-right">
                        <span className="text-[13px] font-semibold text-white">
                          {formaResult.muscle_mass === "above_average" ? "Powyżej średniej" : formaResult.muscle_mass === "average" ? "Średnia" : "Poniżej średniej"}
                        </span>
                        {muscleKg && <span className="text-[11px] text-white/40 ml-1">(~{muscleKg} kg)</span>}
                      </div>
                    </div>
                    {leanMass && (
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-white/50">⚖️ Masa beztłuszczowa</span>
                        <span className="text-[13px] font-semibold text-white">~{leanMass} kg</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-white/50">📏 BMI</span>
                      <span className="text-[13px] font-semibold text-white">{formaResult.bmi} — {formaResult.bmi_category}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Strengths */}
            {formaResult.visible_strengths && formaResult.visible_strengths.length > 0 && (
              <div className="rounded-[20px] p-5 bg-white/[0.04] border border-white/[0.08] border-l-4 border-l-emerald-500">
                <h3 className="font-bold text-emerald-400 mb-3 text-[13px]">✅ Mocne strony</h3>
                <ul className="space-y-2">
                  {formaResult.visible_strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-white/60">
                      <span className="text-emerald-400">•</span><span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Areas to improve */}
            {formaResult.areas_to_improve && formaResult.areas_to_improve.length > 0 && (
              <div className="rounded-[20px] p-5 bg-white/[0.04] border border-white/[0.08] border-l-4 border-l-blue-500">
                <h3 className="font-bold text-blue-400 mb-3 text-[13px]">🎯 Do poprawy</h3>
                <ul className="space-y-2">
                  {formaResult.areas_to_improve.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-white/60">
                      <span className="text-blue-400">•</span><span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tip */}
            {formaResult.tip && (
              <div className="rounded-[20px] p-5 bg-white/[0.04] border border-white/[0.08] border-l-4 border-l-amber-500">
                <h3 className="font-bold text-amber-400 mb-2 text-[13px]">💡 Rada</h3>
                <p className="text-[13px] text-white/60 leading-relaxed">{formaResult.tip}</p>
              </div>
            )}

            {/* Photo warnings */}
            {formaResult.photo_warnings && formaResult.photo_warnings.length > 0 && (
              <div className="rounded-[20px] p-4 bg-amber-500/10 border border-amber-500/20">
                <p className="text-[11px] font-semibold text-amber-400 mb-2">📸 Wskazówki do zdjęcia:</p>
                {formaResult.photo_warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-400/70">{w}</p>
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-[10px] text-white/25 text-center leading-relaxed px-4">
              ⚠️ Wartości szacunkowe na podstawie zdjęcia. Dokładny pomiar wymaga DEXA lub kaliperów. Nie traktuj jako diagnozy medycznej.
            </p>
          </div>
        )}

        {/* ─── 7. PROS / CONS / TIP ─── */}
        {/* Meal pros/cons/tip */}
        {isMeal && (
          <div className="mt-5 space-y-3 anim-fade-up-2">
            {result.pros && result.pros.length > 0 && (
              <div className="velvet-card rounded-[20px] p-5 border-l-4 border-l-emerald-500">
                <h3 className="font-bold text-emerald-400 mb-3 text-[13px]">✓ Plusy</h3>
                <ul className="space-y-2">
                  {result.pros.map((p, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] text-white/60">
                      <span className="text-emerald-400 font-bold">+</span><span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.cons && result.cons.length > 0 && (
              <div className="velvet-card rounded-[20px] p-5 border-l-4 border-l-red-500">
                <h3 className="font-bold text-red-400 mb-3 text-[13px]">✗ Minusy</h3>
                <ul className="space-y-2">
                  {result.cons.map((c, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] text-white/60">
                      <span className="text-red-400 font-bold">−</span><span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.tip && (
              <div className="velvet-card rounded-[20px] p-5 border-l-4 border-l-amber-500">
                <h3 className="font-bold text-amber-400 mb-2 text-[13px]">💡 Rada</h3>
                <p className="text-[13px] text-white/60 leading-relaxed">{result.tip}</p>
              </div>
            )}
          </div>
        )}

        {/* bottom spacing */}
        <div className="h-6" />
      </div>

      {/* Ingredient explanation popup */}
      <IngredientPopup ingredient={selectedIngredient} onClose={() => setSelectedIngredient(null)} />
    </div>
  );
}
