"use client";

import { useState } from "react";
import { AnalysisResult } from "@/lib/types";
import IngredientCard from "./IngredientCard";
import NutritionTable from "./NutritionTable";

const tabs = [
  { id: "ingredients", label: "🧪 Skład" },
  { id: "nutrition", label: "📊 Wartości" },
  { id: "review", label: "⚖️ Ocena" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function ResultTabs({ result }: { result: AnalysisResult }) {
  const [active, setActive] = useState<TabId>("ingredients");

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              active === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {active === "ingredients" && (
        <div className="space-y-3">
          {result.ingredients.map((ing, i) => (
            <IngredientCard key={i} ingredient={ing} />
          ))}
        </div>
      )}

      {active === "nutrition" && (
        <NutritionTable items={result.nutrition} />
      )}

      {active === "review" && (
        <div className="space-y-4">
          {/* Plusy */}
          <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
            <h3 className="font-semibold text-green-800 mb-2">Plusy</h3>
            <ul className="space-y-1.5">
              {result.pros.map((pro, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                  <span className="mt-0.5">✓</span>
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Minusy */}
          <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
            <h3 className="font-semibold text-red-800 mb-2">Minusy</h3>
            <ul className="space-y-1.5">
              {result.cons.map((con, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                  <span className="mt-0.5">✗</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Rada */}
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-2">💡 Rada eksperta</h3>
            <p className="text-sm text-blue-700">{result.tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}
