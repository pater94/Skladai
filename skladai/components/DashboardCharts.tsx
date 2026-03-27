"use client";

import { DailyTotals } from "@/lib/types";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

interface Props {
  weekData: DailyTotals[];
  targetCalories: number;
  view: "week" | "month";
}

const DAY_NAMES = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];

export default function DashboardCharts({ weekData, targetCalories, view }: Props) {
  const chartData = weekData.map((d) => {
    const date = new Date(d.date);
    return {
      day: DAY_NAMES[date.getDay()],
      date: `${date.getDate()}.${date.getMonth() + 1}`,
      calories: d.calories,
      protein: Math.round(d.protein),
      sugar: Math.round(d.sugar * 10) / 10,
      score: d.avgScore,
      target: targetCalories,
    };
  });

  const hasData = chartData.some((d) => d.calories > 0);
  if (!hasData) {
    return (
      <div className="text-center py-8">
        <span className="text-3xl block mb-2">📊</span>
        <p className="text-[12px] text-gray-400">Brak danych za ten okres. Dodaj produkty do dziennika.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Calories trend */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">⚡ Kalorie</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey={view === "week" ? "day" : "date"} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
            <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, fontSize: 11, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
              formatter={(value) => [`${value} kcal`, "Kalorie"]}
            />
            <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.calories > targetCalories ? "#EF4444" : "#84CC16"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Protein trend */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">💪 Białko</p>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey={view === "week" ? "day" : "date"} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
            <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, fontSize: 11, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
              formatter={(value) => [`${value}g`, "Białko"]}
            />
            <Line type="monotone" dataKey="protein" stroke="#2D5A16" strokeWidth={2} dot={{ r: 3, fill: "#2D5A16" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Sugar trend */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">🥄 Cukier</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey={view === "week" ? "day" : "date"} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
            <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, fontSize: 11, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
              formatter={(value) => [`${value}g (${Math.round(Number(value) / 4)} łyżeczek)`, "Cukier"]}
            />
            <Bar dataKey="sugar" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.sugar > 25 ? "#EF4444" : entry.sugar > 15 ? "#F59E0B" : "#84CC16"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">📋 Podsumowanie</p>
        <div className="bg-gray-50 rounded-[16px] overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-semibold text-gray-400">Parametr</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-400">Średnia</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const daysWithData = chartData.filter(d => d.calories > 0);
                if (daysWithData.length === 0) return null;
                const avgCal = Math.round(daysWithData.reduce((s, d) => s + d.calories, 0) / daysWithData.length);
                const avgProt = Math.round(daysWithData.reduce((s, d) => s + d.protein, 0) / daysWithData.length);
                const avgSugar = Math.round(daysWithData.reduce((s, d) => s + d.sugar, 0) / daysWithData.length * 10) / 10;
                const avgScore = daysWithData.filter(d => d.score > 0).length > 0
                  ? Math.round(daysWithData.filter(d => d.score > 0).reduce((s, d) => s + d.score, 0) / daysWithData.filter(d => d.score > 0).length * 10) / 10
                  : 0;

                return (
                  <>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-600">⚡ Kalorie</td>
                      <td className="py-2 px-3 text-right font-bold text-[#1A3A0A]">{avgCal} kcal</td>
                      <td className="py-2 px-3 text-right">{avgCal <= targetCalories * 1.1 ? "🟢" : "🔴"}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-600">💪 Białko</td>
                      <td className="py-2 px-3 text-right font-bold text-[#1A3A0A]">{avgProt}g</td>
                      <td className="py-2 px-3 text-right">{avgProt >= 50 ? "🟢" : "🟡"}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-600">🥄 Cukier</td>
                      <td className="py-2 px-3 text-right font-bold text-[#1A3A0A]">{avgSugar}g</td>
                      <td className="py-2 px-3 text-right">{avgSugar <= 25 ? "🟢" : avgSugar <= 40 ? "🟡" : "🔴"}</td>
                    </tr>
                    {avgScore > 0 && (
                      <tr>
                        <td className="py-2 px-3 text-gray-600">⭐ Średnia ocena</td>
                        <td className="py-2 px-3 text-right font-bold text-[#1A3A0A]">{avgScore}/10</td>
                        <td className="py-2 px-3 text-right">{avgScore >= 7 ? "🟢" : avgScore >= 4 ? "🟡" : "🔴"}</td>
                      </tr>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
