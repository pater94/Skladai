"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getHistory, isPremium } from "@/lib/storage";
import PremiumGate from "@/components/PremiumGate";
import { getScoreColor } from "@/components/ScoreRing";

interface ShoppingItem {
  id: string;
  text: string;
  checked: boolean;
  source: "favorite" | "alternative" | "custom";
  score?: number;
}

const STORAGE_KEY = "skladai_shopping";

function getList(): ShoppingItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function saveList(items: ShoppingItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function ZakupyPage() {
  const router = useRouter();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [hasPremium, setHasPremium] = useState(false);

  useEffect(() => {
    setHasPremium(isPremium());
    const existing = getList();

    // Auto-add favorites (score >= 8) from history
    const history = getHistory();
    const favorites = history.filter((h) => h.score >= 8 && h.scanType === "food");
    const existingTexts = new Set(existing.map((i) => i.text.toLowerCase()));

    const newFavs: ShoppingItem[] = [];
    for (const fav of favorites) {
      const text = fav.name;
      if (!existingTexts.has(text.toLowerCase())) {
        newFavs.push({
          id: "fav_" + fav.id,
          text,
          checked: false,
          source: "favorite",
          score: fav.score,
        });
        existingTexts.add(text.toLowerCase());
      }
    }

    const merged = [...existing, ...newFavs];
    setItems(merged);
    if (newFavs.length > 0) saveList(merged);
    setLoaded(true);
  }, []);

  const toggle = (id: string) => {
    const updated = items.map((i) => i.id === id ? { ...i, checked: !i.checked } : i);
    setItems(updated);
    saveList(updated);
  };

  const remove = (id: string) => {
    const updated = items.filter((i) => i.id !== id);
    setItems(updated);
    saveList(updated);
  };

  const addCustom = () => {
    if (!newItem.trim()) return;
    const item: ShoppingItem = {
      id: Date.now().toString(36),
      text: newItem.trim(),
      checked: false,
      source: "custom",
    };
    const updated = [...items, item];
    setItems(updated);
    saveList(updated);
    setNewItem("");
  };

  const clearChecked = () => {
    const updated = items.filter((i) => !i.checked);
    setItems(updated);
    saveList(updated);
  };

  if (loaded && !hasPremium) {
    return <PremiumGate feature="Lista zakupów — zdrowsze zamienniki" isPremium={false}><div /></PremiumGate>;
  }

  if (!loaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F5F2EB]">
        <div className="w-12 h-12 border-4 border-[#2D5A16] border-t-transparent rounded-full" style={{ animation: "spinSlow 0.8s linear infinite" }} />
      </div>
    );
  }

  const favorites = items.filter((i) => i.source === "favorite");
  const customs = items.filter((i) => i.source === "custom");
  const alternatives = items.filter((i) => i.source === "alternative");
  const checkedCount = items.filter((i) => i.checked).length;

  const renderItem = (item: ShoppingItem) => {
    const scoreColor = item.score ? getScoreColor(item.score) : null;
    return (
      <div key={item.id} className={`flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 ${item.checked ? "opacity-40" : ""}`}>
        <button onClick={() => toggle(item.id)}
          className={`w-6 h-6 rounded-[8px] flex items-center justify-center flex-shrink-0 transition-all ${
            item.checked ? "bg-[#2D5A16] text-white" : "border-2 border-gray-300"
          }`}>
          {item.checked && <span className="text-[12px]">✓</span>}
        </button>
        <span className={`flex-1 text-[13px] font-medium ${item.checked ? "line-through text-gray-400" : "text-gray-700"}`}>
          {item.text}
        </span>
        {scoreColor && item.score && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: scoreColor.bg, color: scoreColor.color }}>
            {item.score}/10
          </span>
        )}
        <button onClick={() => remove(item.id)} className="text-gray-300 hover:text-red-500 text-[14px] px-1">✕</button>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-[#F5F2EB]">
      <div className="matcha-hero relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/10 blur-[60px]" />
        <div className="max-w-md mx-auto px-5 pt-6 pb-24 relative z-10">
          <button onClick={() => router.push("/")}
            className="flex items-center gap-2 text-[13px] text-white/80 font-semibold px-4 py-2 rounded-full bg-white/10 border border-white/20 active:scale-95 transition-all mb-6">
            ← Powrót
          </button>
          <div className="text-center">
            <h1 className="text-[24px] font-black text-white">🛒 Lista zakupów</h1>
            <p className="text-white/50 text-[13px] mt-1">{items.length} produktów · {checkedCount} kupione</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 -mt-14 pb-24 relative z-20">
        {/* Add custom item */}
        <div className="card-elevated rounded-[20px] p-4 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
              placeholder="Dodaj produkt..."
              className="flex-1 px-4 py-3 rounded-[14px] bg-gray-50 text-[13px] font-medium outline-none focus:ring-2 focus:ring-[#84CC16]"
            />
            <button onClick={addCustom}
              className="px-4 py-3 bg-[#1A3A0A] text-white font-bold rounded-[14px] active:scale-[0.95] transition-all text-[14px]">
              +
            </button>
          </div>
        </div>

        {/* Alternatives */}
        {alternatives.length > 0 && (
          <div className="card-elevated rounded-[20px] p-5 mb-4">
            <p className="text-[13px] font-bold text-[#1A3A0A] mb-2">💡 Zdrowsze zamienniki</p>
            {alternatives.map(renderItem)}
          </div>
        )}

        {/* Favorites */}
        {favorites.length > 0 && (
          <div className="card-elevated rounded-[20px] p-5 mb-4">
            <p className="text-[13px] font-bold text-[#1A3A0A] mb-2">⭐ Ulubione (ocena ≥8)</p>
            {favorites.map(renderItem)}
          </div>
        )}

        {/* Custom */}
        {customs.length > 0 && (
          <div className="card-elevated rounded-[20px] p-5 mb-4">
            <p className="text-[13px] font-bold text-[#1A3A0A] mb-2">📝 Własne</p>
            {customs.map(renderItem)}
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-12">
            <span className="text-5xl block mb-4">🛒</span>
            <p className="text-gray-400 text-[14px] font-semibold">Lista jest pusta</p>
            <p className="text-gray-300 text-[12px] mt-1">Zeskanuj produkty z oceną 8+ — automatycznie trafią tu jako ulubione</p>
          </div>
        )}

        {/* Clear checked */}
        {checkedCount > 0 && (
          <button onClick={clearChecked}
            className="w-full py-3 text-[13px] text-red-400 font-semibold mt-2">
            🗑️ Usuń kupione ({checkedCount})
          </button>
        )}
      </div>
    </div>
  );
}
