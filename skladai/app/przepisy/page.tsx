"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";

type Goal = "reduction" | "mass" | "maintenance";

interface Recipe {
  name: string;
  emoji: string;
  calories: number;
  protein: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  prep_time_min: number;
  difficulty: string;
  difficulty_emoji: string;
  uses_ingredients: string[];
  missing_ingredients: string[];
  short_description: string;
  why_good_for_goal: string;
  tags?: string[];
}

interface RecipeIngredient {
  name: string;
  amount: string;
  in_fridge: boolean;
  calories?: number;
  note?: string | null;
}

interface RecipeStep {
  number: number;
  title: string;
  time_min: number;
  instruction: string;
  tip?: string;
}

interface RecipeDetail {
  name: string;
  subtitle: string;
  emoji: string;
  servings: number;
  prep_time_min: number;
  difficulty: string;
  nutrition: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber: number;
    sugar?: number;
  };
  percent_of_daily?: number;
  goal_comment: string;
  ingredients: RecipeIngredient[];
  seasonings: string;
  steps: RecipeStep[];
  pro_tips: string[];
  verdict?: string;
}

const GOAL_OPTIONS: { key: Goal; label: string; icon: string }[] = [
  { key: "reduction", label: "Redukcja", icon: "🔥" },
  { key: "mass", label: "Masa", icon: "💪" },
  { key: "maintenance", label: "Utrzymanie", icon: "⚖️" },
];

export default function PrzepisyPage() {
  const [goal, setGoal] = useState<Goal>("maintenance");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState("");
  const [productList, setProductList] = useState("");
  const [savedRecipes, setSavedRecipes] = useState<string[]>([]);

  // Load fridge products from localStorage on mount
  useEffect(() => {
    try {
      const fridge = localStorage.getItem("skladai_fridge_products");
      if (fridge && fridge.trim().length > 0) {
        setInput(fridge.trim());
      }
      const saved = localStorage.getItem("skladai_saved_recipes");
      if (saved) setSavedRecipes(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSearch = async () => {
    if (!input.trim() || input.trim().length < 2) return;
    setLoading(true);
    setError("");
    setRecipes(null);
    setDetail(null);
    setProductList(input.trim());
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "fridge_recipes", text: input.trim(), goal }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Nie udało się wygenerować przepisów.");
      }
      const data = await res.json();
      setRecipes(data.recipes || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Wystapil blad.");
    } finally {
      setLoading(false);
    }
  };

  const handleRecipeDetail = async (recipeName: string) => {
    setLoadingDetail(true);
    setError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "recipe_detail",
          text: recipeName,
          ingredients: productList,
          goal,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Nie udało się wygenerować przepisu.");
      }
      const data = await res.json();
      setDetail(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Wystapil blad.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSaveRecipe = (name: string) => {
    try {
      const updated = savedRecipes.includes(name)
        ? savedRecipes.filter((r) => r !== name)
        : [...savedRecipes, name];
      setSavedRecipes(updated);
      localStorage.setItem("skladai_saved_recipes", JSON.stringify(updated));
    } catch {}
  };

  const handleAddToDiary = () => {
    if (!detail) return;
    try {
      const entry = {
        id: Date.now().toString(),
        date: new Date().toISOString().slice(0, 10),
        mealType: "lunch",
        productName: detail.name,
        brand: "",
        score: 8,
        portion_g: 0,
        package_g: 0,
        calories: detail.nutrition.calories,
        protein: detail.nutrition.protein,
        fat: detail.nutrition.fat,
        carbs: detail.nutrition.carbs,
        sugar: detail.nutrition.sugar || 0,
        salt: 0,
        fiber: detail.nutrition.fiber,
        scanId: "",
        timestamp: new Date().toISOString(),
      };
      const existing = JSON.parse(localStorage.getItem("skladai_diary") || "[]");
      existing.push(entry);
      localStorage.setItem("skladai_diary", JSON.stringify(existing));
      alert("Dodano do dziennika!");
    } catch {
      alert("Nie udało się dodać do dziennika.");
    }
  };

  const handleAddMissing = () => {
    if (!detail) return;
    try {
      const missing = detail.ingredients.filter((i) => !i.in_fridge).map((i) => i.name);
      if (missing.length === 0) {
        alert("Masz wszystkie składniki!");
        return;
      }
      const existing = JSON.parse(localStorage.getItem("skladai_shopping_list") || "[]");
      const newItems = missing.filter((m) => !existing.includes(m));
      localStorage.setItem("skladai_shopping_list", JSON.stringify([...existing, ...newItems]));
      alert(`Dodano ${newItems.length} brakujących składników do listy zakupów!`);
    } catch {
      alert("Nie udało się dodać do listy.");
    }
  };

  // Nutrition bar helper
  const NutrientBar = ({ label, value, max, color, unit = "g" }: { label: string; value: number; max: number; color: string; unit?: string }) => {
    const pct = Math.min((value / max) * 100, 100);
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="w-20 text-gray-600 font-medium">{label}</span>
        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-14 text-right text-gray-700 font-semibold">{value}{unit}</span>
      </div>
    );
  };

  // ============ RECIPE DETAIL VIEW ============
  if (detail) {
    return (
      <div className="min-h-screen pb-24" style={{ background: "#F5F2EB" }}>
        <div className="max-w-md mx-auto px-4 pt-6">
          {/* Back */}
          <button
            onClick={() => setDetail(null)}
            className="flex items-center gap-1 text-sm font-semibold mb-4"
            style={{ color: "#3A7D0A" }}
          >
            <span>←</span> Wstecz do listy
          </button>

          {/* Header */}
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <div className="text-center mb-3">
              <span className="text-4xl">{detail.emoji}</span>
              <h1 className="text-xl font-bold text-gray-900 mt-2">{detail.name}</h1>
              {detail.subtitle && (
                <p className="text-sm text-gray-500 mt-1">{detail.subtitle}</p>
              )}
            </div>

            {/* Nutrition breakdown */}
            <div className="space-y-2 mt-4">
              <NutrientBar label="Kalorie" value={detail.nutrition.calories} max={2500} color="bg-orange-400" unit=" kcal" />
              <NutrientBar label="Bialko" value={detail.nutrition.protein} max={100} color="bg-red-400" />
              <NutrientBar label="Tluszcze" value={detail.nutrition.fat} max={80} color="bg-yellow-400" />
              <NutrientBar label="Weglowodany" value={detail.nutrition.carbs} max={300} color="bg-blue-400" />
              {detail.nutrition.fiber > 0 && (
                <NutrientBar label="Blonnik" value={detail.nutrition.fiber} max={30} color="bg-green-400" />
              )}
            </div>

            {detail.percent_of_daily && (
              <p className="text-xs text-center text-gray-400 mt-2">
                {detail.percent_of_daily}% dziennego zapotrzebowania
              </p>
            )}
          </div>

          {/* Goal comment */}
          {detail.goal_comment && (
            <div className="rounded-2xl p-4 mb-4" style={{ background: "linear-gradient(135deg, #E8F5E9, #F1F8E9)" }}>
              <p className="text-sm font-medium" style={{ color: "#2E7D32" }}>
                {GOAL_OPTIONS.find((g) => g.key === goal)?.icon}{" "}
                {detail.goal_comment}
              </p>
            </div>
          )}

          {/* Ingredients */}
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <h2 className="font-bold text-gray-900 mb-3">Składniki</h2>
            <div className="space-y-2">
              {detail.ingredients.map((ing, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5">{ing.in_fridge ? "✅" : "⚠️"}</span>
                  <div className="flex-1">
                    <span className={`font-medium ${ing.in_fridge ? "text-gray-800" : "text-orange-700"}`}>
                      {ing.name}
                    </span>
                    <span className="text-gray-500 ml-1">{ing.amount}</span>
                    {ing.note && <span className="text-gray-400 ml-1 text-xs">({ing.note})</span>}
                  </div>
                  {ing.calories != null && (
                    <span className="text-xs text-gray-400">{ing.calories} kcal</span>
                  )}
                </div>
              ))}
            </div>

            {/* Seasonings */}
            {detail.seasonings && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">Przyprawy:</span>{" "}
                  {detail.seasonings}
                </p>
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <h2 className="font-bold text-gray-900 mb-3">Przygotowanie</h2>
            <div className="space-y-4">
              {detail.steps.map((step) => (
                <div key={step.number} className="relative pl-8">
                  <div
                    className="absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #4CAF50, #2E7D32)" }}
                  >
                    {step.number}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">{step.title}</h3>
                  {step.time_min > 0 && (
                    <span className="text-xs text-gray-400">⏱ {step.time_min} min</span>
                  )}
                  <p className="text-sm text-gray-700 mt-1">{step.instruction}</p>
                  {step.tip && (
                    <p className="text-xs mt-1 px-2 py-1 rounded-lg" style={{ background: "#FFF8E1", color: "#F57F17" }}>
                      💡 {step.tip}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pro tips */}
          {detail.pro_tips && detail.pro_tips.length > 0 && (
            <div className="rounded-2xl p-4 mb-4" style={{ background: "linear-gradient(135deg, #FFF8E1, #FFF3E0)" }}>
              <h3 className="font-bold text-sm mb-2" style={{ color: "#E65100" }}>
                🌟 Pro tipy
              </h3>
              <ul className="space-y-1">
                {detail.pro_tips.map((tip, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1">
                    <span>•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Verdict */}
          {detail.verdict && (
            <p className="text-center text-sm text-gray-500 italic mb-4">
              &quot;{detail.verdict}&quot;
            </p>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={handleAddToDiary}
              className="py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #4CAF50, #2E7D32)" }}
            >
              Dodaj do dziennika
            </button>
            <button
              onClick={handleAddMissing}
              className="py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #FF9800, #E65100)" }}
            >
              Dodaj brakujące do listy zakupów
            </button>
            <button
              onClick={() => handleSaveRecipe(detail.name)}
              className={`py-3 rounded-xl text-sm font-semibold border-2 col-span-1 ${
                savedRecipes.includes(detail.name)
                  ? "border-yellow-400 bg-yellow-50 text-yellow-700"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              {savedRecipes.includes(detail.name) ? "⭐ Zapisano" : "⭐ Zapisz"}
            </button>
            <button
              onClick={() => setDetail(null)}
              className="py-3 rounded-xl text-sm font-semibold border-2 border-gray-200 bg-white text-gray-700"
            >
              ← Wstecz
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ============ MAIN VIEW (search + recipe list) ============
  return (
    <div className="min-h-screen pb-24" style={{ background: "#F5F2EB" }}>
      <div className="max-w-md mx-auto px-4 pt-6">
        {/* Back */}
        <Link
          href="/"
          className="flex items-center gap-1 text-sm font-semibold mb-4"
          style={{ color: "#3A7D0A" }}
        >
          <span>←</span> Wstecz
        </Link>

        {/* Title */}
        <div className="text-center mb-5">
          <h1 className="text-2xl font-bold text-gray-900">
            🧊 Smart Przepisy
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Wpisz co masz w lodowce, a AI zaproponuje dania
          </p>
        </div>

        {/* Goal toggle */}
        <div className="flex gap-2 mb-4 justify-center">
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g.key}
              onClick={() => setGoal(g.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                goal === g.key
                  ? "text-white shadow-md"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
              style={
                goal === g.key
                  ? { background: "linear-gradient(135deg, #4CAF50, #2E7D32)" }
                  : undefined
              }
            >
              {g.icon} {g.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <label className="text-xs font-semibold text-gray-500 block mb-2">
            Wpisz co masz w domu: np. kurczak, ryz, brokul, jajka
          </label>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="kurczak, ryz, brokul, jajka, ser..."
              rows={3}
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
              style={{ background: "#FAFAF7" }}
            />
            <button
              className="self-end px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-lg"
              title="Dyktuj (wkrotce)"
              disabled
            >
              🎙️
            </button>
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || input.trim().length < 2}
            className="w-full mt-3 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg, #4CAF50, #2E7D32)" }}
          >
            {loading ? "Szukam przepisów..." : "🔍 Znajdź przepisy"}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-12">
            <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-500 font-medium">Szukam przepisów...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading detail overlay */}
        {loadingDetail && (
          <div className="flex flex-col items-center py-12">
            <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-500 font-medium">Generuje przepis...</p>
          </div>
        )}

        {/* Recipe list */}
        {recipes && recipes.length > 0 && !loading && !loadingDetail && (
          <div className="space-y-3">
            <h2 className="font-bold text-gray-900 text-sm">
              Znalezione przepisy ({recipes.length})
            </h2>
            {recipes.map((recipe, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-4 shadow-sm"
              >
                {/* Title row */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0">{recipe.emoji}</span>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">{recipe.name}</h3>
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2"
                    style={{ background: "#E8F5E9", color: "#2E7D32" }}
                  >
                    {recipe.difficulty_emoji} {recipe.difficulty}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex gap-3 text-xs text-gray-500 mb-2">
                  <span>🔥 {recipe.calories} kcal</span>
                  <span>💪 {recipe.protein}g bialka</span>
                  <span>⏱ {recipe.prep_time_min} min</span>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-600 mb-2">{recipe.short_description}</p>

                {/* Why good */}
                <div
                  className="text-xs px-2 py-1.5 rounded-lg mb-3"
                  style={{ background: "#F1F8E9", color: "#33691E" }}
                >
                  {GOAL_OPTIONS.find((g) => g.key === goal)?.icon}{" "}
                  {recipe.why_good_for_goal}
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleRecipeDetail(recipe.name)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #4CAF50, #2E7D32)" }}
                >
                  🍽️ Zobacz przepis
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {recipes && recipes.length === 0 && !loading && (
          <div className="text-center py-8">
            <span className="text-4xl">🧐</span>
            <p className="text-sm text-gray-500 mt-2">
              Nie znaleziono przepisów. Spróbuj dodać więcej produktów.
            </p>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
