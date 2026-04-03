"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { ScanHistoryItem, ScanMode } from "@/lib/types";
import { getHistory, clearHistory, removeHistoryItem } from "@/lib/storage";
import { getScoreColor } from "./ScoreRing";

interface HistoryListProps {
  isCosmetics?: boolean;
  mode?: ScanMode;
}

export default function HistoryList({ isCosmetics = false, mode }: HistoryListProps) {
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const refreshHistory = () => {
    const all = getHistory();
    if (mode && mode !== "text_search") {
      setHistory(all.filter((item) => (item.scanType || "food") === mode));
    } else {
      setHistory(all);
    }
  };

  useEffect(() => {
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleDelete = (id: string) => {
    removeHistoryItem(id);
    refreshHistory();
    setDeleteConfirm(null);
  };

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
          const typeIcon = item.scanType === "cosmetics" ? "✨" : item.scanType === "meal" ? "🍽️" : item.scanType === "suplement" ? "💊" : item.scanType === "forma" ? "🔥" : "🍎";
          return (
            <div
              key={item.id}
              className="relative"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <Link
                href={`/wyniki/${item.id}`}
                className={`flex items-center gap-3.5 rounded-[18px] p-3.5 ${isCosmetics ? "velvet-card" : "card-elevated"}`}
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
              {/* Delete button */}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirm(item.id); }}
                className="absolute top-2 right-2 p-1.5 rounded-lg transition-all active:scale-90 z-10"
                style={{ background: "rgba(239,68,68,0.12)" }}
              >
                <Trash2 size={12} style={{ color: "#ef4444" }} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (() => {
        const item = history.find((h) => h.id === deleteConfirm);
        return item ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.8)" }}
            onClick={() => setDeleteConfirm(null)}
          >
            <div
              className="w-[85%] max-w-xs rounded-2xl p-5"
              style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-white mb-4">
                Usunąć &quot;{item.name}&quot; z {new Date(item.date).toLocaleDateString("pl-PL")}?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
                >
                  Nie
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}
                >
                  Tak, usuń
                </button>
              </div>
            </div>
          </div>
        ) : null;
      })()}
    </div>
  );
}
