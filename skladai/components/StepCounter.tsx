"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isNative,
  isHealthAvailable,
  requestStepPermissions,
  getTodaySteps,
  getWeekSteps,
  type DailySteps,
} from "@/lib/health-steps";

const DAY_NAMES = ["Nd", "Pn", "Wt", "Sr", "Cz", "Pt", "Sb"];
const DEFAULT_GOAL = 10_000;
const STORAGE_KEY = "skladai_step_goal";

function getGoal(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) return parseInt(v, 10) || DEFAULT_GOAL;
  } catch {}
  return DEFAULT_GOAL;
}

export default function StepCounter() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permitted, setPermitted] = useState(false);
  const [todaySteps, setTodaySteps] = useState<number | null>(null);
  const [weekData, setWeekData] = useState<DailySteps[]>([]);
  const [goal] = useState(getGoal);
  const [loading, setLoading] = useState(true);

  // Check availability on mount
  useEffect(() => {
    if (!isNative()) {
      setSupported(false);
      setLoading(false);
      return;
    }
    isHealthAvailable().then((ok) => {
      setSupported(ok);
      if (!ok) setLoading(false);
    });
  }, []);

  // Request permissions once we know it is supported
  useEffect(() => {
    if (supported !== true) return;
    requestStepPermissions().then((ok) => {
      setPermitted(ok);
      if (!ok) setLoading(false);
    });
  }, [supported]);

  // Fetch data once permitted
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [steps, week] = await Promise.all([getTodaySteps(), getWeekSteps(7)]);
    setTodaySteps(steps);
    setWeekData(week);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!permitted) return;
    fetchData();
    // Refresh every 60s while component is mounted
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [permitted, fetchData]);

  // --- Render nothing on web ---
  if (supported === false) return null;

  // --- Loading state ---
  if (supported === null || loading) {
    return (
      <div className="card-elevated rounded-[18px] p-4 animate-pulse">
        <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
        <div className="h-8 w-32 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-full bg-gray-100 rounded" />
      </div>
    );
  }

  // --- Permission not granted ---
  if (!permitted) {
    return (
      <div className="card-elevated rounded-[18px] p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">👟</span>
          <span className="text-[14px] font-bold text-[#1A3A0A]">Kroki</span>
        </div>
        <p className="text-[12px] text-gray-400 mb-3">
          Pozwol na dostep do danych o krokach, zeby sledzic swoja aktywnosc.
        </p>
        <button
          onClick={async () => {
            const ok = await requestStepPermissions();
            setPermitted(ok);
          }}
          className="w-full py-2.5 rounded-[12px] bg-emerald-50 text-emerald-600 font-bold text-[13px] active:scale-95 transition-transform"
        >
          Wlacz sledzenie krokow
        </button>
      </div>
    );
  }

  // --- Main UI ---
  const steps = todaySteps ?? 0;
  const percent = Math.min(100, Math.round((steps / goal) * 100));
  const maxSteps = Math.max(goal, ...weekData.map((d) => d.steps), 1);
  const goalReached = steps >= goal;

  // Color gradient based on progress
  const progressColor =
    percent >= 100
      ? "from-emerald-400 to-green-400"
      : percent >= 60
        ? "from-emerald-400 to-emerald-500"
        : "from-emerald-500 to-emerald-600";
  const textColor = percent >= 80 ? "text-emerald-500" : "text-emerald-600";

  return (
    <div className="card-elevated rounded-[18px] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">👟</span>
          <span className="text-[14px] font-bold text-[#1A3A0A]">Kroki dzis</span>
        </div>
        <span className={`text-[13px] font-bold ${textColor}`}>{percent}%</span>
      </div>

      {/* Today count */}
      <div className="flex items-baseline gap-1 mb-2">
        <span className={`text-[22px] font-black ${textColor}`}>
          {steps.toLocaleString("pl-PL")}
        </span>
        <span className="text-[13px] text-gray-400 font-medium">
          / {goal.toLocaleString("pl-PL")}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 rounded-full bg-emerald-50 overflow-hidden mb-1">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${progressColor} transition-all duration-500 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Status text */}
      <p className="text-[11px] text-gray-400 mb-3">
        {goalReached
          ? "Cel osiagniety! Swietna robota!"
          : `Zostalo: ${(goal - steps).toLocaleString("pl-PL")} krokow`}
      </p>

      {/* 7-day mini bar chart */}
      {weekData.length > 0 && (
        <div className="mt-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Ostatnie 7 dni
          </p>
          <div className="flex items-end gap-1.5 h-[60px]">
            {weekData.map((day, i) => {
              const d = new Date(day.date + "T00:00:00");
              const label = DAY_NAMES[d.getDay()];
              const barH = maxSteps > 0 ? Math.max(4, (day.steps / maxSteps) * 52) : 4;
              const isToday = i === weekData.length - 1;
              const reachedGoal = day.steps >= goal;
              const barColor = reachedGoal
                ? "bg-emerald-400"
                : isToday
                  ? "bg-emerald-300"
                  : "bg-emerald-200";

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className="text-[8px] text-gray-400 font-medium leading-none">
                    {day.steps >= 1000 ? `${(day.steps / 1000).toFixed(1)}k` : day.steps}
                  </span>
                  <div
                    className={`w-full rounded-t-[4px] ${barColor} transition-all duration-300`}
                    style={{ height: barH }}
                  />
                  <span
                    className={`text-[9px] leading-none ${
                      isToday ? "font-bold text-emerald-600" : "text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Goal line indicator */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="h-[1px] flex-1 bg-emerald-300 opacity-50" />
            <span className="text-[9px] text-emerald-400 font-medium">
              Cel: {(goal / 1000).toFixed(0)}k
            </span>
          </div>
        </div>
      )}

      {/* Refresh button */}
      <button
        onClick={fetchData}
        className="mt-3 w-full py-2 rounded-[10px] bg-emerald-50 text-emerald-600 font-bold text-[11px] active:scale-95 transition-transform"
      >
        Odswiez dane
      </button>
    </div>
  );
}
