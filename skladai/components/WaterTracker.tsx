"use client";

import { useState, useEffect, useCallback } from "react";

interface WaterEntry {
  time: string;
  ml: number;
  type: "glass" | "bottle" | "custom";
}

interface WaterDay {
  target_ml: number;
  consumed_ml: number;
  entries: WaterEntry[];
}

const WATER_KEY_PREFIX = "water_";

function todayKey(): string {
  return WATER_KEY_PREFIX + new Date().toISOString().split("T")[0];
}

function getDefaultTarget(): number {
  try {
    const profile = JSON.parse(localStorage.getItem("skladai_profile") || "null");
    if (profile?.weight_kg) return Math.round(profile.weight_kg * 35 / 100) * 100; // round to 100ml
  } catch {}
  return 2500;
}

function getWaterDay(): WaterDay {
  try {
    const data = localStorage.getItem(todayKey());
    if (data) return JSON.parse(data) as WaterDay;
  } catch {}
  return { target_ml: getDefaultTarget(), consumed_ml: 0, entries: [] };
}

function saveWaterDay(day: WaterDay): void {
  localStorage.setItem(todayKey(), JSON.stringify(day));
}

export default function WaterTracker() {
  const [water, setWater] = useState<WaterDay>({ target_ml: 2500, consumed_ml: 0, entries: [] });
  const [showCustom, setShowCustom] = useState(false);
  const [customMl, setCustomMl] = useState("");
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setWater(getWaterDay());
  }, []);

  const addWater = useCallback((ml: number, type: WaterEntry["type"]) => {
    setAnimating(true);
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
    const updated = { ...water };
    updated.consumed_ml += ml;
    updated.entries.push({ time, ml, type });
    saveWaterDay(updated);
    setWater(updated);
    setShowCustom(false);
    setCustomMl("");
    setTimeout(() => setAnimating(false), 600);
  }, [water]);

  const percent = Math.min(100, Math.round((water.consumed_ml / water.target_ml) * 100));
  const remaining = Math.max(0, water.target_ml - water.consumed_ml);
  const glasses = Math.ceil(remaining / 250);

  // Color based on progress
  const barColor = percent >= 80 ? "from-blue-400 to-cyan-400" : percent >= 50 ? "from-blue-400 to-blue-500" : "from-blue-500 to-blue-600";
  const textColor = percent >= 80 ? "text-cyan-500" : "text-blue-500";

  return (
    <div className="card-elevated rounded-[18px] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">💧</span>
          <span className="text-[14px] font-bold text-[#1A3A0A]">Woda dziś</span>
        </div>
        <span className={`text-[13px] font-bold ${textColor}`}>{percent}%</span>
      </div>

      {/* Stats */}
      <div className="flex items-baseline gap-1 mb-2">
        <span className={`text-[22px] font-black ${textColor}`}>
          {water.consumed_ml >= 1000 ? `${(water.consumed_ml / 1000).toFixed(1)}L` : `${water.consumed_ml}ml`}
        </span>
        <span className="text-[13px] text-gray-400 font-medium">
          / {water.target_ml >= 1000 ? `${(water.target_ml / 1000).toFixed(1)}L` : `${water.target_ml}ml`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 rounded-full bg-blue-50 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-600 ease-out`}
          style={{ width: `${percent}%`, transition: animating ? "width 0.6s ease-out" : "width 0.3s ease-out" }}
        />
      </div>

      {/* Remaining */}
      <p className="text-[11px] text-gray-400 mb-3">
        {remaining > 0
          ? `Zostało: ${remaining >= 1000 ? `${(remaining / 1000).toFixed(1)}L` : `${remaining}ml`} (${glasses} ${glasses === 1 ? "szklanka" : glasses < 5 ? "szklanki" : "szklanek"})`
          : "🎉 Cel osiągnięty! Świetna robota!"
        }
      </p>

      {/* Quick add buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => addWater(250, "glass")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[12px] bg-blue-50 text-blue-600 font-bold text-[12px] active:scale-95 transition-transform"
        >
          <span>🥛</span>
          <span>+250ml</span>
        </button>
        <button
          onClick={() => addWater(500, "bottle")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[12px] bg-blue-50 text-blue-600 font-bold text-[12px] active:scale-95 transition-transform"
        >
          <span>🫗</span>
          <span>+500ml</span>
        </button>
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[12px] bg-blue-50 text-blue-600 font-bold text-[12px] active:scale-95 transition-transform"
        >
          <span>✏️</span>
          <span>Inne</span>
        </button>
      </div>

      {/* Custom input */}
      {showCustom && (
        <div className="flex gap-2 mt-2">
          <input
            type="number"
            value={customMl}
            onChange={(e) => setCustomMl(e.target.value)}
            placeholder="ml"
            className="flex-1 px-3 py-2 rounded-[10px] bg-gray-50 text-[13px] text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={() => {
              const ml = parseInt(customMl);
              if (ml > 0 && ml <= 5000) addWater(ml, "custom");
            }}
            className="px-4 py-2 rounded-[10px] bg-blue-500 text-white font-bold text-[12px] active:scale-95 transition-transform"
          >
            Dodaj
          </button>
        </div>
      )}

      {/* Today's entries (collapsed, show last 3) */}
      {water.entries.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap gap-1.5">
            {water.entries.slice(-5).map((e, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-blue-50 text-[10px] text-blue-500 font-medium">
                {e.time} · {e.ml}ml
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
