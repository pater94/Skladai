"use client";

import { useState, useEffect, useCallback } from "react";

interface IngredientInfo {
  name: string;
  explanation: string;
  risk_level: "safe" | "caution" | "warning";
  who_should_worry: string;
  fun_fact: string;
}

export default function IngredientPopup({
  ingredient,
  onClose,
}: {
  ingredient: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<IngredientInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = useCallback(async (name: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: name, mode: "ingredient_explain" }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Błąd"); return; }
      setData(json);
    } catch {
      setError("Brak połączenia.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ingredient) fetchExplanation(ingredient);
  }, [ingredient, fetchExplanation]);

  if (!ingredient) return null;

  const riskIcon = data?.risk_level === "warning" ? "🔴" : data?.risk_level === "caution" ? "⚠️" : "✅";
  const riskLabel = data?.risk_level === "warning" ? "Potencjalnie szkodliwy" : data?.risk_level === "caution" ? "Kontrowersyjny" : "Bezpieczny";
  const riskColor = data?.risk_level === "warning" ? "text-red-400" : data?.risk_level === "caution" ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white rounded-t-[24px] p-5 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "slideUp 0.3s ease-out" }}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[18px] font-bold text-gray-900">{ingredient}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl p-1">✕</button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 text-sm">Sprawdzam...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-6">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {/* Data */}
        {data && (
          <div className="space-y-4">
            {/* Risk badge */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold ${
              data.risk_level === "warning" ? "bg-red-50 text-red-600" :
              data.risk_level === "caution" ? "bg-amber-50 text-amber-600" :
              "bg-emerald-50 text-emerald-600"
            }`}>
              {riskIcon} {riskLabel}
            </div>

            {/* Explanation */}
            <p className="text-[14px] text-gray-700 leading-relaxed">{data.explanation}</p>

            {/* Who should worry */}
            <div className="bg-gray-50 rounded-2xl p-3.5">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kto powinien uważać</p>
              <p className={`text-[13px] font-medium ${riskColor}`}>{data.who_should_worry}</p>
            </div>

            {/* Fun fact */}
            {data.fun_fact && (
              <div className="bg-blue-50 rounded-2xl p-3.5">
                <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-1">💡 Ciekawostka</p>
                <p className="text-[13px] text-blue-700">{data.fun_fact}</p>
              </div>
            )}
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
