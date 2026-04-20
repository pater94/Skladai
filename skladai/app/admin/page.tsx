"use client";

import { useState, useEffect, useCallback } from "react";

interface ScanLog {
  id: string;
  mode: string;
  scan_type: string | null;
  image_url: string | null;
  image2_url: string | null;
  ocr_text: string | null;
  ai_result: Record<string, unknown> | null;
  ai_model: string | null;
  score: number | null;
  product_name: string | null;
  brand: string | null;
  user_feedback: string | null;
  feedback_note: string | null;
  prompt_version: string | null;
  processing_time_ms: number | null;
  created_at: string;
  // Analytics columns (may be null on older rows)
  ocr_succeeded: boolean | null;
  is_two_photo: boolean | null;
  harmful_count: number | null;
  has_pregnancy_warning: boolean | null;
  ingredient_count: number | null;
  risk_level: string | null;
  verdict_short: string | null;
  error_type: string | null;
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
  error: "Bledy",
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

// Short inline chip for scan metadata (OCR ok / 2-photo / harmful / preg)
function Chip({ label, tone }: { label: string; tone: "ok" | "warn" | "bad" | "mute" }) {
  const colors: Record<string, { bg: string; fg: string; border: string }> = {
    ok: { bg: "rgba(16,185,129,0.12)", fg: "#6ee7b7", border: "rgba(16,185,129,0.28)" },
    warn: { bg: "rgba(245,158,11,0.12)", fg: "#fcd34d", border: "rgba(245,158,11,0.28)" },
    bad: { bg: "rgba(239,68,68,0.12)", fg: "#fca5a5", border: "rgba(239,68,68,0.28)" },
    mute: { bg: "rgba(255,255,255,0.04)", fg: "rgba(255,255,255,0.55)", border: "rgba(255,255,255,0.08)" },
  };
  const c = colors[tone];
  return (
    <span
      style={{
        padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
        background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
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
  const [feedbackFilter, setFeedbackFilter] = useState("any"); // any | good | bad | none
  const [ocrFilter, setOcrFilter] = useState("any"); // any | true | false
  const [scoreMin, setScoreMin] = useState<string>("");
  const [scoreMax, setScoreMax] = useState<string>("");
  const [promptVersionFilter, setPromptVersionFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchScans = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (modeFilter !== "all") params.set("mode", modeFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (feedbackFilter !== "any") params.set("feedback", feedbackFilter);
      if (ocrFilter !== "any") params.set("ocr_ok", ocrFilter);
      if (scoreMin) params.set("score_min", scoreMin);
      if (scoreMax) params.set("score_max", scoreMax);
      if (promptVersionFilter.trim()) params.set("prompt_version", promptVersionFilter.trim());
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
  }, [password, modeFilter, dateFrom, dateTo, feedbackFilter, ocrFilter, scoreMin, scoreMax, promptVersionFilter, page]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthenticated(true);
  };

  useEffect(() => {
    if (authenticated && password) {
      fetchScans();
    }
  }, [authenticated, password, fetchScans]);

  const clearAllFilters = () => {
    setModeFilter("all");
    setDateFrom("");
    setDateTo("");
    setFeedbackFilter("any");
    setOcrFilter("any");
    setScoreMin("");
    setScoreMax("");
    setPromptVersionFilter("");
    setPage(1);
  };

  // Quick-filter preset buttons — the common review slices for a batch
  // of test scans. "Bad feedback" + "OCR failed" + "Errors" cover ~90%
  // of what I want to look at after each upload.
  const applyPreset = (preset: "bad_feedback" | "ocr_failed" | "errors" | "low_score") => {
    setPage(1);
    clearAllFilters();
    setTimeout(() => {
      if (preset === "bad_feedback") setFeedbackFilter("bad");
      if (preset === "ocr_failed") setOcrFilter("false");
      if (preset === "errors") setModeFilter("error");
      if (preset === "low_score") { setScoreMin("1"); setScoreMax("4"); }
    }, 0);
  };

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

        {/* Quick-filter presets — the "show me problems" shortcuts */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => applyPreset("bad_feedback")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-900/50 text-red-300 hover:bg-red-900/20 transition"
          >
            👎 Zle feedbacki
          </button>
          <button
            onClick={() => applyPreset("ocr_failed")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-yellow-900/50 text-yellow-300 hover:bg-yellow-900/20 transition"
          >
            📷 OCR failed
          </button>
          <button
            onClick={() => applyPreset("errors")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-900/50 text-red-300 hover:bg-red-900/20 transition"
          >
            ⚠️ Bledy (timeouts/parse)
          </button>
          <button
            onClick={() => applyPreset("low_score")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-orange-900/50 text-orange-300 hover:bg-orange-900/20 transition"
          >
            📉 Niski score (1-4)
          </button>
          <button
            onClick={clearAllFilters}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-800 text-gray-400 hover:bg-gray-900/40 transition"
          >
            Wyczysc
          </button>
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
            <label className="text-xs text-gray-400 block mb-1">Feedback</label>
            <select
              value={feedbackFilter}
              onChange={(e) => { setFeedbackFilter(e.target.value); setPage(1); }}
              className="p-2 rounded-lg border border-emerald-900/50 text-white text-sm"
              style={{ background: "#0a0f0d" }}
            >
              <option value="any">Wszystkie</option>
              <option value="good">👍 Dobre</option>
              <option value="bad">👎 Zle</option>
              <option value="none">Bez feedbacku</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">OCR</label>
            <select
              value={ocrFilter}
              onChange={(e) => { setOcrFilter(e.target.value); setPage(1); }}
              className="p-2 rounded-lg border border-emerald-900/50 text-white text-sm"
              style={{ background: "#0a0f0d" }}
            >
              <option value="any">Wszystkie</option>
              <option value="true">OCR OK</option>
              <option value="false">OCR failed</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Score min</label>
            <input
              type="number"
              min={1}
              max={10}
              value={scoreMin}
              onChange={(e) => { setScoreMin(e.target.value); setPage(1); }}
              className="p-2 rounded-lg border border-emerald-900/50 text-white text-sm w-20"
              style={{ background: "#0a0f0d" }}
              placeholder="1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Score max</label>
            <input
              type="number"
              min={1}
              max={10}
              value={scoreMax}
              onChange={(e) => { setScoreMax(e.target.value); setPage(1); }}
              className="p-2 rounded-lg border border-emerald-900/50 text-white text-sm w-20"
              style={{ background: "#0a0f0d" }}
              placeholder="10"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Prompt ver.</label>
            <input
              type="text"
              value={promptVersionFilter}
              onChange={(e) => { setPromptVersionFilter(e.target.value); setPage(1); }}
              className="p-2 rounded-lg border border-emerald-900/50 text-white text-sm w-24"
              style={{ background: "#0a0f0d" }}
              placeholder="v1"
            />
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
                  <th className="p-3">Produkt / Tagi</th>
                  <th className="p-3">Tryb</th>
                  <th className="p-3">Ocena</th>
                  <th className="p-3">Model / ver.</th>
                  <th className="p-3">Czas</th>
                  <th className="p-3">Feedback</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Szczegoly</th>
                </tr>
              </thead>
              <tbody>
                {data.scans.map((scan) => {
                  const isBad = scan.user_feedback === "bad";
                  const isError = scan.ai_model === "error" || !!scan.error_type;
                  return (
                    <tr
                      key={scan.id}
                      className="border-b border-emerald-900/20 hover:bg-emerald-900/10 transition"
                      style={{
                        background: isBad
                          ? "rgba(239,68,68,0.06)"
                          : isError
                            ? "rgba(245,158,11,0.04)"
                            : undefined,
                        borderLeft: isBad
                          ? "3px solid #ef4444"
                          : isError
                            ? "3px solid #f59e0b"
                            : "3px solid transparent",
                      }}
                    >
                      <td className="p-3">
                        {scan.image_url ? (
                          <div className="flex gap-1">
                            <a href={scan.image_url} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={scan.image_url}
                                alt="skan"
                                className="w-12 h-12 object-cover rounded-lg border border-emerald-900/30"
                              />
                            </a>
                            {scan.image2_url && (
                              <a href={scan.image2_url} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={scan.image2_url}
                                  alt="skan 2"
                                  className="w-12 h-12 object-cover rounded-lg border border-emerald-900/30"
                                />
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center text-gray-500 text-xs">
                            brak
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-medium text-white max-w-[260px]">
                        <div className="truncate">
                          {scan.product_name || (isError ? "— (blad)" : "-")}
                        </div>
                        {scan.brand && (
                          <div className="text-xs text-gray-500 truncate">{scan.brand}</div>
                        )}
                        {/* Metadata chips — instantly visible without expanding */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {scan.ocr_succeeded === false && <Chip label="OCR ✗" tone="warn" />}
                          {scan.ocr_succeeded === true && <Chip label="OCR ✓" tone="ok" />}
                          {scan.is_two_photo && <Chip label="2 foto" tone="mute" />}
                          {typeof scan.harmful_count === "number" && scan.harmful_count > 0 && (
                            <Chip label={`${scan.harmful_count} szkodl.`} tone="bad" />
                          )}
                          {scan.has_pregnancy_warning && <Chip label="🤰 ciaza" tone="warn" />}
                          {scan.error_type && <Chip label={scan.error_type} tone="bad" />}
                        </div>
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
                        <div>{scan.ai_model ? scan.ai_model.replace("claude-", "").replace("-20250514", "") : "-"}</div>
                        {scan.prompt_version && (
                          <div className="text-gray-600">{scan.prompt_version}</div>
                        )}
                      </td>
                      <td className="p-3 text-gray-400">
                        {scan.processing_time_ms ? `${(scan.processing_time_ms / 1000).toFixed(1)}s` : "-"}
                      </td>
                      <td className="p-3">
                        {scan.user_feedback === "good" && <span className="text-emerald-400 font-bold">👍</span>}
                        {scan.user_feedback === "bad" && <span className="text-red-400 font-bold">👎</span>}
                        {!scan.user_feedback && <span className="text-gray-600">-</span>}
                        {scan.feedback_note && (
                          <div className="text-xs text-gray-400 mt-1 max-w-[180px] truncate" title={scan.feedback_note}>
                            {scan.feedback_note}
                          </div>
                        )}
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
                          {expandedId === scan.id ? "Zwiń" : "Pokaz"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Expanded view — show OCR text, feedback note (full), AI result JSON */}
            {expandedId && (() => {
              const scan = data.scans.find((s) => s.id === expandedId);
              if (!scan) return null;
              return (
                <div className="p-4 border-t border-emerald-900/30 space-y-4">
                  {scan.feedback_note && (
                    <div>
                      <h3 className="text-sm font-medium text-red-400 mb-1">Feedback użytkownika:</h3>
                      <p className="text-xs text-gray-300 p-3 rounded-lg whitespace-pre-wrap" style={{ background: "#0a0f0d" }}>
                        {scan.feedback_note}
                      </p>
                    </div>
                  )}
                  {scan.ocr_text && (
                    <div>
                      <h3 className="text-sm font-medium text-yellow-400 mb-1">
                        OCR (Google Vision / Claude):
                      </h3>
                      <pre className="text-xs text-gray-300 overflow-x-auto max-h-64 overflow-y-auto p-3 rounded-lg whitespace-pre-wrap" style={{ background: "#0a0f0d" }}>
                        {scan.ocr_text}
                      </pre>
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-medium text-emerald-400 mb-1">Wynik AI (JSON):</h3>
                    <pre className="text-xs text-gray-300 overflow-x-auto max-h-96 overflow-y-auto p-3 rounded-lg" style={{ background: "#0a0f0d" }}>
                      {JSON.stringify(scan.ai_result, null, 2)}
                    </pre>
                  </div>
                  <div className="text-xs text-gray-500 flex gap-4 flex-wrap">
                    <span>ID: <code className="text-gray-400">{scan.id}</code></span>
                    <span>Mode: {scan.mode}</span>
                    <span>Scan type: {scan.scan_type || "-"}</span>
                    <span>Prompt ver: {scan.prompt_version || "-"}</span>
                    <span>Risk: {scan.risk_level || "-"}</span>
                    <span>Ingredients: {scan.ingredient_count ?? "-"}</span>
                  </div>
                </div>
              );
            })()}
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
