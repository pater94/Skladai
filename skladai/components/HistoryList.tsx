"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScanHistoryItem } from "@/lib/types";
import { getHistory, clearHistory } from "@/lib/storage";
import { getScoreColor } from "./ScoreRing";

export default function HistoryList() {
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  if (history.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">Ostatnie skany</h2>
        <button
          onClick={() => {
            clearHistory();
            setHistory([]);
          }}
          className="text-sm text-gray-400 hover:text-red-500 transition-colors"
        >
          Wyczyść historię
        </button>
      </div>

      <div className="space-y-2">
        {history.map((item) => {
          const { color } = getScoreColor(item.score);
          return (
            <Link
              key={item.id}
              href={`/wyniki/${item.id}`}
              className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <img
                src={item.thumbnail}
                alt={item.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{item.name}</p>
                <p className="text-xs text-gray-400">
                  {item.brand} &middot;{" "}
                  {new Date(item.date).toLocaleDateString("pl-PL")}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: color }}
              >
                {item.score}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
