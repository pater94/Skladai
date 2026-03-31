"use client";

import { useState, useEffect, useCallback } from "react";

interface ScanLog {
  id: string;
  mode: string;
  image_url: string | null;
  image2_url: string | null;
  ai_result: Record<string, unknown> | null;
  ai_model: string | null;
  score: number | null;
  product_name: string | null;
  user_feedback: string | null;
  feedback_note: string | null;
  prompt_version: string | null;
  processing_time_ms: number | null;
  created_at: string;
}

interface ScansResponse {
  scans: ScanLog[];
  total: number;
  page: number;
  totalPages: number;
}

const MODE_LABELS: Record<string, string> = {
  food: "Jedzenie",
  cosmetics: "Kosmetyki",
  meal: "Danie",
  suplement: "Suplement",
  fridge_scan: "Lodowka",
  forma: "CheckForm",
  alcohol_search: "Alkohol (szukaj)",
  alcohol_scan: "Alkohol (skan)",
};

const SCORE_COLORS: Record<string, string> = {
  high: "text-emerald-400",
  mid: "text-yellow-400",
  low: "text-red-400",
};

function getScoreColor(score: number | null): string {
  if (!score) return "text-gray-500";
  if (score >= 7) return SCORE_COLORS.high;
  if (score >= 4) return SCORE_COLORS.mid;
  return SCORE_COLORS.low;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ScansResponse | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [modeFilter, setModeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const fetchScans = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (modeFilter !== "all") params.set("mode", modeFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      params.set("page", page.toString());

      const res = await fetch(`/api/admin/scans?${params}`, {
        headers: { "x-admin-password": password },
      });

      if (res.status === 401) {
        setAuthenticated(false);
        setError("Nieprawidlowe haslo.");
        return;
      }

      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }

      setData(json);
    } catch {
      setError("Blad polaczenia z serwerem.");
    } finally {
      setLoading(false);
    }
  }, [password, modeFilter, dateFrom, dateTo, page]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthenticated(true);
  };

  useEffect(() => {
    if (authenticated && password) {
      fetchScans();
    }
  }, [authenticated, password, fetchScans]);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f0d" }}>
        <form onSubmit={handleLogin} className="p-6 rounded-2xl border border-emerald-900/50 max-w-sm w-full" style={{ background: "#111a14" }}>
          <h1 className="text-xl font-bold text-emerald-400 mb-4">Admin Panel</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Haslo administratora"
            className="w-full p-3 rounded-lg border border-emerald-900/50 text-white placeholder-gray-500 mb-3"
            style={{ background: "#0a0f0d" }}
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            type="submit"
            className="w-full py-3 rounded-lg font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
          >
            Zaloguj
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: "#0a0f0d" }}>
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-emerald-400">Panel Administracyjny - Skany</h1>
          <div className="flex items-center gap-3">
            {data && (
              <span className="text-sm text-gray-400">
                Razem: {data.total} skanow
              </span>
            )}
            <button
              onClick={() => { setAuthenticated(false); setPassword(""); setData(null); }}
              className="text-sm text-gray-400 hover:text-red-400 transition"
            >
              Wyloguj
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 p-4 rounded-xl border border-emerald-900/30" style={{ background: "#111a14" }}>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Tryb</label>
            <select
              value={modeFilter}
              onChange={(e) => { setModeFilter(e.target.value); setPage(1); }}
              className="p-2 rounded-lg border border-emerald-900/50 text-white text-sm"
              style={{ background: "#0a0f0d" }}
            >
              <option value="all">Wszystkie</option>
              {Object.entries(MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Od daty</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="p-2 rounded-lg border border-emerald-900/50 text-white text-sm"
              style={{ background: "#0a0f0d" }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Do daty</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="p-2 rounded-lg border border-emerald-900/50 text-white text-sm"
              style={{ background: "#0a0f0d" }}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setModeFilter("all"); setDateFrom(""); setDateTo(""); setPage(1); }}
              className="p-2 text-sm text-gray-400 hover:text-emerald-400 transition"
            >
              Wyczysc filtry
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 mb-4">{error}</p>}
        {loading && <p className="text-gray-400 mb-4">Ladowanie...</p>}

        {/* Table */}
        {data && data.scans.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-emerald-900/30" style={{ background: "#111a14" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-900/30 text-gray-400 text-left">
                  <th className="p-3">Obraz</th>
                  <th className="p-3">Produkt</th>
                  <th className="p-3">Tryb</th>
                  <th className="p-3">Ocena</th>
                  <th className="p-3">Model</th>
                  <th className="p-3">Czas (ms)</th>
                  <th className="p-3">Feedback</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Szczegoly</th>
                </tr>
              </thead>
              <tbody>
                {data.scans.map((scan) => (
                  <tr key={scan.id} className="border-b border-emerald-900/20 hover:bg-emerald-900/10 transition">
                    <td className="p-3">
                      {scan.image_url ? (
                        <a href={scan.image_url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={scan.image_url}
                            alt="skan"
                            className="w-12 h-12 object-cover rounded-lg border border-emerald-900/30"
                          />
                        </a>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center text-gray-500 text-xs">
                          brak
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-medium text-white max-w-[200px] truncate">
                      {scan.product_name || "-"}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-900/30 text-emerald-400">
                        {MODE_LABELS[scan.mode] || scan.mode}
                      </span>
                    </td>
                    <td className={`p-3 font-bold ${getScoreColor(scan.score)}`}>
                      {scan.score !== null ? `${scan.score}/10` : "-"}
                    </td>
                    <td className="p-3 text-gray-400 text-xs">
                      {scan.ai_model ? scan.ai_model.replace("claude-", "").replace("-20250514", "") : "-"}
                    </td>
                    <td className="p-3 text-gray-400">
                      {scan.processing_time_ms ? `${(scan.processing_time_ms / 1000).toFixed(1)}s` : "-"}
                    </td>
                    <td className="p-3">
                      {scan.user_feedback === "good" && <span className="text-emerald-400">+</span>}
                      {scan.user_feedback === "bad" && <span className="text-red-400">-</span>}
                      {!scan.user_feedback && <span className="text-gray-600">-</span>}
                    </td>
                    <td className="p-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(scan.created_at).toLocaleDateString("pl-PL", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setExpandedId(expandedId === scan.id ? null : scan.id)}
                        className="text-emerald-400 hover:text-emerald-300 text-xs underline"
                      >
                        {expandedId === scan.id ? "Zwiń" : "JSON"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Expanded JSON view */}
            {expandedId && (
              <div className="p-4 border-t border-emerald-900/30">
                <h3 className="text-sm font-medium text-emerald-400 mb-2">Wynik AI (JSON):</h3>
                <pre className="text-xs text-gray-300 overflow-x-auto max-h-96 overflow-y-auto p-3 rounded-lg" style={{ background: "#0a0f0d" }}>
                  {JSON.stringify(
                    data.scans.find((s) => s.id === expandedId)?.ai_result,
                    null,
                    2
                  )}
                </pre>
              </div>
            )}
          </div>
        )}

        {data && data.scans.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            Brak skanow dla wybranych filtrow.
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-lg text-sm border border-emerald-900/50 text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-900/20 transition"
            >
              Poprzednia
            </button>
            <span className="text-sm text-gray-400">
              {page} / {data.totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(data.totalPages, page + 1))}
              disabled={page >= data.totalPages}
              className="px-4 py-2 rounded-lg text-sm border border-emerald-900/50 text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-900/20 transition"
            >
              Nastepna
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
