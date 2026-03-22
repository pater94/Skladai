"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ScanHistoryItem } from "@/lib/types";
import { getHistoryItem } from "@/lib/storage";
import ScoreRing, { getScoreColor } from "@/components/ScoreRing";
import ResultTabs from "@/components/ResultTabs";

export default function WynikiPage() {
  const params = useParams();
  const router = useRouter();
  const [item, setItem] = useState<ScanHistoryItem | null>(null);

  useEffect(() => {
    const id = params.id as string;
    const found = getHistoryItem(id);
    if (!found) {
      router.push("/");
      return;
    }
    setItem(found);
  }, [params.id, router]);

  if (!item) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#2E7D32] border-t-transparent rounded-full" />
      </div>
    );
  }

  const result = item.result;
  const { color, bg } = getScoreColor(result.score);

  const verdictBadgeStyle = {
    backgroundColor: bg,
    color: color,
    borderColor: color,
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          ← Powrót
        </button>

        {/* Score card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
          <div className="flex items-start gap-4">
            <ScoreRing score={result.score} size={100} />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                {result.name}
              </h1>
              <p className="text-sm text-gray-500">
                {result.brand}
                {result.weight && ` · ${result.weight}`}
              </p>
              <span
                className="inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full border"
                style={verdictBadgeStyle}
              >
                {result.verdict_short}
              </span>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600 leading-relaxed">
            {result.verdict}
          </p>
        </div>

        {/* Allergens */}
        {result.allergens && result.allergens.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
            <p className="text-sm font-semibold text-orange-800 mb-2">
              ⚠️ Alergeny
            </p>
            <div className="flex flex-wrap gap-2">
              {result.allergens.map((allergen, i) => (
                <span
                  key={i}
                  className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-1 rounded-full"
                >
                  {allergen}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <ResultTabs result={result} />

        {/* Scan another */}
        <button
          onClick={() => router.push("/")}
          className="w-full mt-6 py-3.5 bg-[#2E7D32] text-white font-semibold rounded-xl hover:bg-[#256829] transition-colors"
        >
          📸 Skanuj kolejny produkt
        </button>
      </div>
    </div>
  );
}
