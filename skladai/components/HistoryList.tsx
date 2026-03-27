"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ScanHistoryItem, ScanMode } from "@/lib/types";
import { getHistory, clearHistory } from "@/lib/storage";
import { getScoreColor } from "./ScoreRing";

interface HistoryListProps {
  isCosmetics?: boolean;
  mode?: ScanMode;
}

export default function HistoryList({ isCosmetics = false, mode }: HistoryListProps) {
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  useEffect(() => {
    const all = getHistory();
    if (mode && mode !== "text_search") {
      const filtered = all.filter((item) => {
        const itemType = item.scanType || "food";
        return itemType === mode;
      });
      setHistory(filtered);
    } else {
      setHistory(all);
    }
  }, [mode]);

  if (history.length === 0) return null;

  return (
    <div className="mt-10 anim-fade-up-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-[15px] font-bold ${isCosmetics ? "text-white" : "text-[#1A3A0A]"}`}>
          Historia skanów
        </h2>
        <button
          onClick={() => { clearHistory(); setHistory([]); }}
          className={`text-[11px] hover:text-red-500 transition-colors font-bold uppercase tracking-wider ${isCosmetics ? "text-white/30" : "text-gray-400"}`}
        >
          Wyczyść
        </button>
      </div>

      <div className="space-y-2.5">
        {history.map((item, i) => {
          const { gradient } = getScoreColor(item.score);
          const typeIcon = item.scanType === "cosmetics" ? "✨" : item.scanType === "meal" ? "🍽️" : "🍎";
          return (
            <Link
              key={item.id}
              href={`/wyniki/${item.id}`}
              className={`flex items-center gap-3.5 rounded-[18px] p-3.5 ${isCosmetics ? "velvet-card" : "card-elevated"}`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="relative">
                <img
                  src={item.thumbnail}
                  alt={item.name}
                  className="w-14 h-14 rounded-[14px] object-cover"
                />
                <span className={`absolute -top-1 -right-1 text-[10px] rounded-full w-5 h-5 flex items-center justify-center shadow-sm ${isCosmetics ? "bg-[#0D0B0E] border border-white/10" : "bg-white border border-gray-100"}`}>
                  {typeIcon}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold truncate text-[13px] ${isCosmetics ? "text-white" : "text-[#1A3A0A]"}`}>
                  {item.name}
                </p>
                <p className={`text-[11px] mt-0.5 font-medium ${isCosmetics ? "text-white/35" : "text-gray-400"}`}>
                  {item.brand} · {new Date(item.date).toLocaleDateString("pl-PL")}
                </p>
              </div>
              <div
                className="w-11 h-11 rounded-[12px] flex items-center justify-center text-white font-bold text-[13px]"
                style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
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
